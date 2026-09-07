// Package kernel tests the strategy-facing Binance futures context.
package kernel

import (
	"nofx/market"
	"nofx/store"
	"strings"
	"testing"
)

// TestFormatMarketDataIncludesEnabledBinanceContext verifies the model receives every first-phase field.
func TestFormatMarketDataIncludesEnabledBinanceContext(t *testing.T) {
	config := store.GetDefaultStrategyConfig("en")
	config.Indicators.EnableOI = true
	config.Indicators.EnableFundingRate = true
	config.Indicators.EnableTakerFlow = true
	config.Indicators.EnableLongShortRatio = true
	config.Indicators.EnableOrderBook = true
	engine := NewStrategyEngine(&config)
	data := &market.Data{
		Symbol:       "BTCUSDT",
		CurrentPrice: 50000,
		OpenInterest: &market.OIData{Latest: 100, LatestUSD: 5_000_000, Change15mPct: 1, Change1hPct: 2, Change4hPct: 3, Timestamp: 1_800_000_000_000},
		Funding:      &market.FundingData{Rate: 0.0001, MarkPrice: 50001, NextFundingTime: 1_800_028_800_000, Timestamp: 1_800_000_000_000},
		TakerFlow:    &market.TakerFlowData{BuySellRatio: 1.2, BuyVolume: 120, SellVolume: 100, Timestamp: 1_800_000_000_000},
		LongShortRatio: &market.LongShortRatioData{
			AccountLongShortRatio: 1.5, AccountLongAccountPct: 60, AccountShortAccountPct: 40,
			PositionLongShortRatio: 2, PositionLongAccountPct: 66.67, PositionShortAccountPct: 33.33,
			Timestamp: 1_800_000_000_000,
		},
		OrderBook: &market.OrderBookData{
			Depth: 20, SpreadBps: 0.2, Imbalance: 0.1, BidNotionalUSD: 100000, AskNotionalUSD: 90000,
			ReferenceNotionalUSD: 40, EstimatedBuySlippageBps: 0.3, EstimatedSellSlippageBps: 0.4,
			BuyDepthSufficient: true, SellDepthSufficient: true, Timestamp: 1_800_000_000_000,
		},
		DerivativeWarnings: []string{"test_source: unavailable"},
	}

	prompt := engine.formatMarketData(data)
	for _, expected := range []string{
		"OI: 100.00 contracts / 5000000.00 USD",
		"Funding: +0.0100%",
		"5m taker flow: buy/sell 1.2000",
		"Top traders: accounts L/S 1.5000",
		"Order book: 20 levels/side",
		"40.00 USD buy/sell slippage",
		"source 2027-01-15 08:00:00 UTC",
		"unavailable: test_source: unavailable",
	} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt does not contain %q:\n%s", expected, prompt)
		}
	}
}

// TestOrderBookReferenceNotionalUsesTighterRiskLimit verifies the two independent position caps.
func TestOrderBookReferenceNotionalUsesTighterRiskLimit(t *testing.T) {
	risk := store.RiskControlConfig{
		BTCETHMaxLeverage: 2, AltcoinMaxLeverage: 3,
		BTCETHMaxPositionValueRatio: 0.5, AltcoinMaxPositionValueRatio: 0.8,
		MaxMarginUsage: 0.2,
	}
	if got := OrderBookReferenceNotional("BTCUSDT", 100, risk); got != 40 {
		t.Fatalf("BTC reference = %.2f, want margin-limited 40", got)
	}
	if got := OrderBookReferenceNotional("SOLUSDT", 100, risk); got != 60 {
		t.Fatalf("SOL reference = %.2f, want margin-limited 60", got)
	}
	risk.MaxMarginUsage = 1
	if got := OrderBookReferenceNotional("BTCUSDT", 100, risk); got != 50 {
		t.Fatalf("BTC reference = %.2f, want position-limited 50", got)
	}
}
