// Package market tests Binance futures context parsing without external requests.
package market

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"
)

// TestEnrichBinanceDerivatives verifies every first-phase response shape and shared cache.
func TestEnrichBinanceDerivatives(t *testing.T) {
	resetBinanceDerivativeTestCaches()
	originalURL := binanceFuturesPublicBaseURL
	originalClient := binanceFuturesPublicClient
	t.Cleanup(func() {
		binanceFuturesPublicBaseURL = originalURL
		binanceFuturesPublicClient = originalClient
		resetBinanceDerivativeTestCaches()
	})

	var mu sync.Mutex
	requestCount := make(map[string]int)
	baseTimestamp := int64(1_800_000_000_000)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		requestCount[r.URL.Path]++
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")

		switch r.URL.Path {
		case "/futures/data/openInterestHist":
			points := make([]binanceOIHistoryPoint, 49)
			for index := range points {
				points[index] = binanceOIHistoryPoint{
					Symbol:               "BTCUSDT",
					SumOpenInterest:      formatTestFloat(100 + float64(index)),
					SumOpenInterestValue: formatTestFloat((100 + float64(index)) * 1000),
					Timestamp:            baseTimestamp + int64(index)*5*time.Minute.Milliseconds(),
				}
			}
			_ = json.NewEncoder(w).Encode(points)
		case "/fapi/v1/premiumIndex":
			_ = json.NewEncoder(w).Encode(binanceFundingResponse{
				Symbol: "BTCUSDT", MarkPrice: "50000", LastFundingRate: "-0.0001",
				NextFundingTime: baseTimestamp + 8*time.Hour.Milliseconds(), Time: baseTimestamp,
			})
		case "/futures/data/takerlongshortRatio":
			_ = json.NewEncoder(w).Encode([]binanceTakerRatioPoint{{
				BuySellRatio: "1.25", BuyVolume: "125", SellVolume: "100", Timestamp: baseTimestamp,
			}})
		case "/futures/data/topLongShortAccountRatio":
			_ = json.NewEncoder(w).Encode([]binanceLongShortPoint{{
				LongShortRatio: "1.5", LongAccount: "0.6", ShortAccount: "0.4", Timestamp: baseTimestamp,
			}})
		case "/futures/data/topLongShortPositionRatio":
			_ = json.NewEncoder(w).Encode([]binanceLongShortPoint{{
				LongShortRatio: "2", LongAccount: "0.6667", ShortAccount: "0.3333", Timestamp: baseTimestamp + 1,
			}})
		case "/fapi/v1/depth":
			_ = json.NewEncoder(w).Encode(binanceDepthResponse{
				LastUpdateID: 1, TransactionTime: baseTimestamp,
				Bids: [][]string{{"99.9", "2"}, {"99.8", "2"}},
				Asks: [][]string{{"100.1", "2"}, {"100.2", "2"}},
			})
		default:
			http.Error(w, "unexpected path", http.StatusNotFound)
		}
	}))
	defer server.Close()
	binanceFuturesPublicBaseURL = server.URL
	binanceFuturesPublicClient = server.Client()

	options := DerivativesOptions{
		IncludeOpenInterest: true, IncludeFundingRate: true, IncludeTakerFlow: true,
		IncludeLongShortRatio: true, IncludeOrderBook: true, ReferenceNotionalUSD: 100,
	}
	first := &Data{Symbol: "BTCUSDT"}
	enrichBinanceDerivatives(first, options)
	second := &Data{Symbol: "BTCUSDT"}
	enrichBinanceDerivatives(second, options)

	if len(first.DerivativeWarnings) != 0 {
		t.Fatalf("unexpected derivative warnings: %v", first.DerivativeWarnings)
	}
	if first.OpenInterest == nil || first.OpenInterest.Latest != 148 || first.OpenInterest.LatestUSD != 148000 {
		t.Fatalf("unexpected OI data: %+v", first.OpenInterest)
	}
	assertClose(t, "OI 15m change", first.OpenInterest.Change15mPct, (148.0-145.0)/145.0*100)
	assertClose(t, "OI 1h change", first.OpenInterest.Change1hPct, (148.0-136.0)/136.0*100)
	assertClose(t, "OI 4h change", first.OpenInterest.Change4hPct, 48)
	if first.Funding == nil || first.Funding.Rate != -0.0001 || first.Funding.MarkPrice != 50000 {
		t.Fatalf("unexpected funding data: %+v", first.Funding)
	}
	if first.TakerFlow == nil || first.TakerFlow.BuySellRatio != 1.25 {
		t.Fatalf("unexpected taker data: %+v", first.TakerFlow)
	}
	if first.LongShortRatio == nil || first.LongShortRatio.AccountLongAccountPct != 60 || first.LongShortRatio.PositionShortAccountPct != 33.33 {
		t.Fatalf("unexpected long/short data: %+v", first.LongShortRatio)
	}
	if first.OrderBook == nil || !first.OrderBook.BuyDepthSufficient || !first.OrderBook.SellDepthSufficient {
		t.Fatalf("unexpected order-book data: %+v", first.OrderBook)
	}
	if first.OrderBook.EstimatedBuySlippageBps <= 0 || first.OrderBook.EstimatedSellSlippageBps <= 0 {
		t.Fatalf("expected positive two-sided slippage: %+v", first.OrderBook)
	}
	if second.OpenInterest != first.OpenInterest || second.OrderBook != first.OrderBook {
		t.Fatal("expected cached snapshots to be reused")
	}
	mu.Lock()
	defer mu.Unlock()
	for path, count := range requestCount {
		if count != 1 {
			t.Fatalf("%s requested %d times, want one shared cached request", path, count)
		}
	}
}

// TestBinancePublicRequestRetries verifies the bounded retry path succeeds on its third attempt.
func TestBinancePublicRequestRetries(t *testing.T) {
	resetBinanceDerivativeTestCaches()
	originalURL := binanceFuturesPublicBaseURL
	originalClient := binanceFuturesPublicClient
	t.Cleanup(func() {
		binanceFuturesPublicBaseURL = originalURL
		binanceFuturesPublicClient = originalClient
		resetBinanceDerivativeTestCaches()
	})

	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		attempts++
		if attempts < 3 {
			http.Error(w, "temporary", http.StatusBadGateway)
			return
		}
		_ = json.NewEncoder(w).Encode(binanceFundingResponse{
			MarkPrice: "100", LastFundingRate: "0.0002", NextFundingTime: 1, Time: 1,
		})
	}))
	defer server.Close()
	binanceFuturesPublicBaseURL = server.URL
	binanceFuturesPublicClient = server.Client()

	value, err := getFundingData("BTCUSDT")
	if err != nil {
		t.Fatalf("third-attempt request failed: %v", err)
	}
	if attempts != 3 || value.Rate != 0.0002 {
		t.Fatalf("attempts/rate = %d/%v, want 3/0.0002", attempts, value.Rate)
	}
}

// TestEnrichBinanceDerivativesReportsUnavailableData verifies failures are not represented as zero signals.
func TestEnrichBinanceDerivativesReportsUnavailableData(t *testing.T) {
	resetBinanceDerivativeTestCaches()
	originalURL := binanceFuturesPublicBaseURL
	originalClient := binanceFuturesPublicClient
	t.Cleanup(func() {
		binanceFuturesPublicBaseURL = originalURL
		binanceFuturesPublicClient = originalClient
		resetBinanceDerivativeTestCaches()
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not available", http.StatusBadRequest)
	}))
	defer server.Close()
	binanceFuturesPublicBaseURL = server.URL
	binanceFuturesPublicClient = server.Client()

	data := &Data{Symbol: "BTCUSDT"}
	enrichBinanceDerivatives(data, DerivativesOptions{IncludeTakerFlow: true})
	if data.TakerFlow != nil || len(data.DerivativeWarnings) != 1 {
		t.Fatalf("expected nil signal and one warning, got data=%+v warnings=%v", data.TakerFlow, data.DerivativeWarnings)
	}
}

// resetBinanceDerivativeTestCaches isolates tests that replace the public API endpoint.
func resetBinanceDerivativeTestCaches() {
	openInterestCache.reset()
	fundingCache.reset()
	takerFlowCache.reset()
	longShortRatioCache.reset()
	orderBookCache.reset()
}

// formatTestFloat encodes predictable Binance-style numeric strings.
func formatTestFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

// assertClose compares floating point calculations with a narrow tolerance.
func assertClose(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("%s = %.12f, want %.12f", name, got, want)
	}
}
