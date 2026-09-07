// Package market collects cached Binance futures context used by AI strategies.
package market

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	binanceFastDataTTL = 30 * time.Second
	binanceOITTL       = time.Minute
	binanceFundingTTL  = time.Hour
)

var (
	binanceFuturesPublicBaseURL = "https://fapi.binance.com"
	binanceFuturesPublicClient  = &http.Client{Timeout: 12 * time.Second}
	openInterestCache           = newSnapshotCache[*OIData]()
	fundingCache                = newSnapshotCache[*FundingData]()
	takerFlowCache              = newSnapshotCache[*TakerFlowData]()
	longShortRatioCache         = newSnapshotCache[*LongShortRatioData]()
	orderBookCache              = newSnapshotCache[*OrderBookData]()
)

type snapshotCacheEntry[T any] struct {
	value     T
	expiresAt time.Time
}

type snapshotCache[T any] struct {
	mu    sync.RWMutex
	items map[string]snapshotCacheEntry[T]
}

// newSnapshotCache creates a process-wide cache shared by every trader.
func newSnapshotCache[T any]() *snapshotCache[T] {
	return &snapshotCache[T]{items: make(map[string]snapshotCacheEntry[T])}
}

// load returns an unexpired cached value.
func (c *snapshotCache[T]) load(key string) (T, bool) {
	c.mu.RLock()
	entry, ok := c.items[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(entry.expiresAt) {
		var zero T
		return zero, false
	}
	return entry.value, true
}

// store saves a value with the supplied cache lifetime.
func (c *snapshotCache[T]) store(key string, value T, ttl time.Duration) {
	c.mu.Lock()
	c.items[key] = snapshotCacheEntry[T]{value: value, expiresAt: time.Now().Add(ttl)}
	c.mu.Unlock()
}

// reset clears cached public data. Tests use it when replacing the API server.
func (c *snapshotCache[T]) reset() {
	c.mu.Lock()
	c.items = make(map[string]snapshotCacheEntry[T])
	c.mu.Unlock()
}

type binanceOIHistoryPoint struct {
	Symbol               string `json:"symbol"`
	SumOpenInterest      string `json:"sumOpenInterest"`
	SumOpenInterestValue string `json:"sumOpenInterestValue"`
	Timestamp            int64  `json:"timestamp"`
}

type binanceFundingResponse struct {
	Symbol          string `json:"symbol"`
	MarkPrice       string `json:"markPrice"`
	LastFundingRate string `json:"lastFundingRate"`
	NextFundingTime int64  `json:"nextFundingTime"`
	Time            int64  `json:"time"`
}

type binanceTakerRatioPoint struct {
	BuySellRatio string `json:"buySellRatio"`
	BuyVolume    string `json:"buyVol"`
	SellVolume   string `json:"sellVol"`
	Timestamp    int64  `json:"timestamp"`
}

type binanceLongShortPoint struct {
	LongShortRatio string `json:"longShortRatio"`
	LongAccount    string `json:"longAccount"`
	ShortAccount   string `json:"shortAccount"`
	Timestamp      int64  `json:"timestamp"`
}

type binanceDepthResponse struct {
	LastUpdateID    int64      `json:"lastUpdateId"`
	EventTime       int64      `json:"E"`
	TransactionTime int64      `json:"T"`
	Bids            [][]string `json:"bids"`
	Asks            [][]string `json:"asks"`
}

type orderBookLevel struct {
	price    float64
	quantity float64
}

// enrichBinanceDerivatives attaches only explicitly requested data and records
// unavailable sources as warnings instead of inventing zero-valued signals.
func enrichBinanceDerivatives(data *Data, options DerivativesOptions) {
	if data == nil {
		return
	}
	if options.IncludeOpenInterest {
		value, err := getOpenInterestData(data.Symbol)
		if err != nil {
			data.DerivativeWarnings = append(data.DerivativeWarnings, "open_interest: "+err.Error())
		} else {
			data.OpenInterest = value
		}
	}
	if options.IncludeFundingRate {
		value, err := getFundingData(data.Symbol)
		if err != nil {
			data.DerivativeWarnings = append(data.DerivativeWarnings, "funding_rate: "+err.Error())
		} else {
			data.Funding = value
		}
	}
	if options.IncludeTakerFlow {
		value, err := getTakerFlowData(data.Symbol)
		if err != nil {
			data.DerivativeWarnings = append(data.DerivativeWarnings, "taker_flow: "+err.Error())
		} else {
			data.TakerFlow = value
		}
	}
	if options.IncludeLongShortRatio {
		value, err := getLongShortRatioData(data.Symbol)
		if err != nil {
			data.DerivativeWarnings = append(data.DerivativeWarnings, "long_short_ratio: "+err.Error())
		} else {
			data.LongShortRatio = value
		}
	}
	if options.IncludeOrderBook {
		value, err := getOrderBookData(data.Symbol, options.ReferenceNotionalUSD)
		if err != nil {
			data.DerivativeWarnings = append(data.DerivativeWarnings, "order_book: "+err.Error())
		} else {
			data.OrderBook = value
		}
	}
}

// getOpenInterestData returns current Binance OI plus real 15m/1h/4h changes.
func getOpenInterestData(symbol string) (*OIData, error) {
	symbol = strings.ToUpper(Normalize(symbol))
	if cached, ok := openInterestCache.load(symbol); ok {
		return cached, nil
	}

	var points []binanceOIHistoryPoint
	query := url.Values{"symbol": {symbol}, "period": {"5m"}, "limit": {"50"}}
	if err := getBinancePublicJSON("/futures/data/openInterestHist", query, &points); err != nil {
		return nil, err
	}
	if len(points) < 2 {
		return nil, fmt.Errorf("history returned %d points", len(points))
	}
	sort.Slice(points, func(i, j int) bool { return points[i].Timestamp < points[j].Timestamp })

	latestPoint := points[len(points)-1]
	if points[0].Timestamp > latestPoint.Timestamp-4*time.Hour.Milliseconds() {
		return nil, fmt.Errorf("history does not cover the required 4h window")
	}
	latest, err := parsePositiveFloat("sumOpenInterest", latestPoint.SumOpenInterest)
	if err != nil {
		return nil, err
	}
	latestUSD, err := parsePositiveFloat("sumOpenInterestValue", latestPoint.SumOpenInterestValue)
	if err != nil {
		return nil, err
	}
	result := &OIData{
		Latest:       latest,
		LatestUSD:    latestUSD,
		Change15mPct: openInterestChange(points, latest, latestPoint.Timestamp-15*time.Minute.Milliseconds()),
		Change1hPct:  openInterestChange(points, latest, latestPoint.Timestamp-time.Hour.Milliseconds()),
		Change4hPct:  openInterestChange(points, latest, latestPoint.Timestamp-4*time.Hour.Milliseconds()),
		Timestamp:    latestPoint.Timestamp,
	}
	openInterestCache.store(symbol, result, binanceOITTL)
	return result, nil
}

// openInterestChange calculates change from the most recent point at or before a target time.
func openInterestChange(points []binanceOIHistoryPoint, latest float64, targetTimestamp int64) float64 {
	for index := len(points) - 1; index >= 0; index-- {
		if points[index].Timestamp > targetTimestamp {
			continue
		}
		past, err := strconv.ParseFloat(points[index].SumOpenInterest, 64)
		if err != nil || past <= 0 {
			return 0
		}
		return (latest - past) / past * 100
	}
	return 0
}

// getFundingData returns the current funding rate and next settlement time.
func getFundingData(symbol string) (*FundingData, error) {
	symbol = strings.ToUpper(Normalize(symbol))
	if cached, ok := fundingCache.load(symbol); ok {
		return cached, nil
	}

	var response binanceFundingResponse
	if err := getBinancePublicJSON("/fapi/v1/premiumIndex", url.Values{"symbol": {symbol}}, &response); err != nil {
		return nil, err
	}
	rate, err := strconv.ParseFloat(response.LastFundingRate, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid lastFundingRate %q: %w", response.LastFundingRate, err)
	}
	markPrice, err := parsePositiveFloat("markPrice", response.MarkPrice)
	if err != nil {
		return nil, err
	}
	result := &FundingData{
		Rate:            rate,
		MarkPrice:       markPrice,
		NextFundingTime: response.NextFundingTime,
		Timestamp:       response.Time,
	}
	fundingCache.store(symbol, result, binanceFundingTTL)
	return result, nil
}

// getTakerFlowData returns the latest five-minute aggressive buy/sell ratio.
func getTakerFlowData(symbol string) (*TakerFlowData, error) {
	symbol = strings.ToUpper(Normalize(symbol))
	if cached, ok := takerFlowCache.load(symbol); ok {
		return cached, nil
	}

	var points []binanceTakerRatioPoint
	query := url.Values{"symbol": {symbol}, "period": {"5m"}, "limit": {"1"}}
	if err := getBinancePublicJSON("/futures/data/takerlongshortRatio", query, &points); err != nil {
		return nil, err
	}
	if len(points) != 1 {
		return nil, fmt.Errorf("taker ratio returned %d points", len(points))
	}
	point := points[0]
	ratio, err := parsePositiveFloat("buySellRatio", point.BuySellRatio)
	if err != nil {
		return nil, err
	}
	buyVolume, err := parsePositiveFloat("buyVol", point.BuyVolume)
	if err != nil {
		return nil, err
	}
	sellVolume, err := parsePositiveFloat("sellVol", point.SellVolume)
	if err != nil {
		return nil, err
	}
	result := &TakerFlowData{BuySellRatio: ratio, BuyVolume: buyVolume, SellVolume: sellVolume, Timestamp: point.Timestamp}
	takerFlowCache.store(symbol, result, binanceFastDataTTL)
	return result, nil
}

// getLongShortRatioData returns Binance top-trader account and position ratios.
func getLongShortRatioData(symbol string) (*LongShortRatioData, error) {
	symbol = strings.ToUpper(Normalize(symbol))
	if cached, ok := longShortRatioCache.load(symbol); ok {
		return cached, nil
	}

	query := url.Values{"symbol": {symbol}, "period": {"5m"}, "limit": {"1"}}
	var accountPoints []binanceLongShortPoint
	if err := getBinancePublicJSON("/futures/data/topLongShortAccountRatio", query, &accountPoints); err != nil {
		return nil, fmt.Errorf("top account ratio: %w", err)
	}
	var positionPoints []binanceLongShortPoint
	if err := getBinancePublicJSON("/futures/data/topLongShortPositionRatio", query, &positionPoints); err != nil {
		return nil, fmt.Errorf("top position ratio: %w", err)
	}
	if len(accountPoints) != 1 || len(positionPoints) != 1 {
		return nil, fmt.Errorf("unexpected account/position ratio point counts: %d/%d", len(accountPoints), len(positionPoints))
	}

	account := accountPoints[0]
	position := positionPoints[0]
	accountRatio, err := parsePositiveFloat("account longShortRatio", account.LongShortRatio)
	if err != nil {
		return nil, err
	}
	accountLong, err := parsePositiveFloat("account longAccount", account.LongAccount)
	if err != nil {
		return nil, err
	}
	accountShort, err := parsePositiveFloat("account shortAccount", account.ShortAccount)
	if err != nil {
		return nil, err
	}
	positionRatio, err := parsePositiveFloat("position longShortRatio", position.LongShortRatio)
	if err != nil {
		return nil, err
	}
	positionLong, err := parsePositiveFloat("position longAccount", position.LongAccount)
	if err != nil {
		return nil, err
	}
	positionShort, err := parsePositiveFloat("position shortAccount", position.ShortAccount)
	if err != nil {
		return nil, err
	}

	result := &LongShortRatioData{
		AccountLongShortRatio:   accountRatio,
		AccountLongAccountPct:   accountLong * 100,
		AccountShortAccountPct:  accountShort * 100,
		PositionLongShortRatio:  positionRatio,
		PositionLongAccountPct:  positionLong * 100,
		PositionShortAccountPct: positionShort * 100,
		Timestamp:               maxInt64(account.Timestamp, position.Timestamp),
	}
	longShortRatioCache.store(symbol, result, binanceFastDataTTL)
	return result, nil
}

// getOrderBookData summarizes the top 20 Binance futures depth levels.
func getOrderBookData(symbol string, referenceNotionalUSD float64) (*OrderBookData, error) {
	symbol = strings.ToUpper(Normalize(symbol))
	if referenceNotionalUSD <= 0 {
		return nil, fmt.Errorf("reference notional must be positive")
	}
	cacheKey := fmt.Sprintf("%s:%.2f", symbol, referenceNotionalUSD)
	if cached, ok := orderBookCache.load(cacheKey); ok {
		return cached, nil
	}

	var response binanceDepthResponse
	query := url.Values{"symbol": {symbol}, "limit": {"20"}}
	if err := getBinancePublicJSON("/fapi/v1/depth", query, &response); err != nil {
		return nil, err
	}
	bids, err := parseOrderBookLevels("bid", response.Bids)
	if err != nil {
		return nil, err
	}
	asks, err := parseOrderBookLevels("ask", response.Asks)
	if err != nil {
		return nil, err
	}
	if len(bids) == 0 || len(asks) == 0 {
		return nil, fmt.Errorf("empty depth response")
	}

	bestBid := bids[0].price
	bestAsk := asks[0].price
	midPrice := (bestBid + bestAsk) / 2
	bidNotional := sumOrderBookNotional(bids)
	askNotional := sumOrderBookNotional(asks)
	totalNotional := bidNotional + askNotional
	imbalance := 0.0
	if totalNotional > 0 {
		imbalance = (bidNotional - askNotional) / totalNotional
	}
	buySlippage, buySufficient := estimateOrderBookSlippage(asks, referenceNotionalUSD, midPrice, true)
	sellSlippage, sellSufficient := estimateOrderBookSlippage(bids, referenceNotionalUSD, midPrice, false)
	timestamp := response.TransactionTime
	if timestamp == 0 {
		timestamp = response.EventTime
	}
	if timestamp == 0 {
		timestamp = time.Now().UnixMilli()
	}

	result := &OrderBookData{
		Depth:                    minInt(len(bids), len(asks)),
		SpreadBps:                (bestAsk - bestBid) / midPrice * 10000,
		BidNotionalUSD:           bidNotional,
		AskNotionalUSD:           askNotional,
		Imbalance:                imbalance,
		ReferenceNotionalUSD:     referenceNotionalUSD,
		EstimatedBuySlippageBps:  buySlippage,
		EstimatedSellSlippageBps: sellSlippage,
		BuyDepthSufficient:       buySufficient,
		SellDepthSufficient:      sellSufficient,
		Timestamp:                timestamp,
	}
	orderBookCache.store(cacheKey, result, binanceFastDataTTL)
	return result, nil
}

// parseOrderBookLevels validates Binance string-encoded price levels.
func parseOrderBookLevels(side string, raw [][]string) ([]orderBookLevel, error) {
	levels := make([]orderBookLevel, 0, len(raw))
	for _, item := range raw {
		if len(item) < 2 {
			return nil, fmt.Errorf("invalid %s depth level", side)
		}
		price, err := parsePositiveFloat(side+" price", item[0])
		if err != nil {
			return nil, err
		}
		quantity, err := parsePositiveFloat(side+" quantity", item[1])
		if err != nil {
			return nil, err
		}
		levels = append(levels, orderBookLevel{price: price, quantity: quantity})
	}
	return levels, nil
}

// sumOrderBookNotional sums price multiplied by quantity for all levels.
func sumOrderBookNotional(levels []orderBookLevel) float64 {
	total := 0.0
	for _, level := range levels {
		total += level.price * level.quantity
	}
	return total
}

// estimateOrderBookSlippage returns VWAP slippage in basis points for one side.
func estimateOrderBookSlippage(levels []orderBookLevel, referenceNotionalUSD, midPrice float64, buy bool) (float64, bool) {
	remaining := referenceNotionalUSD
	baseQuantity := 0.0
	quoteFilled := 0.0
	for _, level := range levels {
		levelNotional := level.price * level.quantity
		usedNotional := levelNotional
		if usedNotional > remaining {
			usedNotional = remaining
		}
		quoteFilled += usedNotional
		baseQuantity += usedNotional / level.price
		remaining -= usedNotional
		if remaining <= 0 {
			break
		}
	}
	if baseQuantity <= 0 || midPrice <= 0 {
		return 0, false
	}
	vwap := quoteFilled / baseQuantity
	slippage := (vwap - midPrice) / midPrice * 10000
	if !buy {
		slippage = (midPrice - vwap) / midPrice * 10000
	}
	return slippage, remaining <= 0
}

// getBinancePublicJSON performs a bounded three-attempt request to Binance.
func getBinancePublicJSON(path string, query url.Values, target any) error {
	endpoint := strings.TrimRight(binanceFuturesPublicBaseURL, "/") + path
	if encoded := query.Encode(); encoded != "" {
		endpoint += "?" + encoded
	}

	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequest(http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}
		resp, err := binanceFuturesPublicClient.Do(req)
		if err != nil {
			lastErr = err
		} else {
			body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
			resp.Body.Close()
			if readErr != nil {
				lastErr = readErr
			} else if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				if err := json.Unmarshal(body, target); err != nil {
					return fmt.Errorf("decode %s: %w", path, err)
				}
				return nil
			} else {
				lastErr = fmt.Errorf("%s returned HTTP %d: %s", path, resp.StatusCode, strings.TrimSpace(string(body)))
				if resp.StatusCode < 500 && resp.StatusCode != http.StatusTooManyRequests {
					return lastErr
				}
			}
		}
		if attempt < 3 {
			time.Sleep(time.Duration(attempt) * 250 * time.Millisecond)
		}
	}
	return fmt.Errorf("%s failed after 3 attempts: %w", path, lastErr)
}

// parsePositiveFloat parses a required positive Binance numeric field.
func parsePositiveFloat(field, value string) (float64, error) {
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("invalid %s %q", field, value)
	}
	return parsed, nil
}

// formatSourceTime renders Binance millisecond timestamps in a compact UTC form.
func formatSourceTime(timestamp int64) string {
	if timestamp <= 0 {
		return "unavailable"
	}
	return time.UnixMilli(timestamp).UTC().Format("2006-01-02 15:04:05 UTC")
}

// maxInt64 returns the later of two millisecond timestamps.
func maxInt64(left, right int64) int64 {
	if left > right {
		return left
	}
	return right
}

// minInt returns the smaller integer.
func minInt(left, right int) int {
	if left < right {
		return left
	}
	return right
}
