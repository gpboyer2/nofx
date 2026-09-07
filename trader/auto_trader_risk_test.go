// Package trader tests code-enforced runtime risk controls.
package trader

import (
	"nofx/store"
	"strings"
	"testing"
)

func TestDrawdownCloseArmsOnPriceBasisOnly(t *testing.T) {
	cases := []struct {
		name        string
		pricePnLPct float64
		drawdownPct float64
		shouldClose bool
	}{
		// +0.5% price move (what +5% margin at 10x used to arm on) must NOT
		// arm the monitor, no matter how large the relative drawdown is.
		{"tiny price gain big drawdown", 0.5, 60.0, false},
		// Armed only from a real +5% price move, and still needs the 40% giveback.
		{"real gain small drawdown", 6.0, 20.0, false},
		{"real gain big drawdown", 6.0, 45.0, true},
		{"at threshold not armed", 5.0, 45.0, false},
		{"loss never triggers", -3.0, 80.0, false},
	}
	for _, c := range cases {
		if got := shouldDrawdownClose(c.pricePnLPct, c.drawdownPct); got != c.shouldClose {
			t.Fatalf("%s: shouldDrawdownClose(%.1f, %.1f) = %v, want %v",
				c.name, c.pricePnLPct, c.drawdownPct, got, c.shouldClose)
		}
	}
}

// TestEnforceMaxMarginUsage includes existing positions in the total margin budget.
func TestEnforceMaxMarginUsage(t *testing.T) {
	strategy := store.GetDefaultStrategyConfig("en")
	strategy.RiskControl.MaxMarginUsage = 0.2
	at := &AutoTrader{config: AutoTraderConfig{StrategyConfig: &strategy}}
	positions := []map[string]interface{}{{
		"positionAmt": 1.0,
		"markPrice":   20.0,
		"leverage":    2.0,
	}}

	if err := at.enforceMaxMarginUsage(20, 2, 100, positions); err != nil {
		t.Fatalf("20 USDT notional should exactly fill the remaining margin budget: %v", err)
	}
	err := at.enforceMaxMarginUsage(30, 2, 100, positions)
	if err == nil || !strings.Contains(err.Error(), "exceeds 20% limit") {
		t.Fatalf("expected total margin rejection, got %v", err)
	}
}

// TestEnforceRiskRewardRatio uses the live market price instead of inferring an
// entry price from the model-provided stop-loss and take-profit values.
func TestEnforceRiskRewardRatio(t *testing.T) {
	strategy := store.GetDefaultStrategyConfig("en")
	strategy.CoinSource.SourceType = "static"
	strategy.RiskControl.MinRiskRewardRatio = 3
	at := &AutoTrader{config: AutoTraderConfig{StrategyConfig: &strategy}}

	if err := at.enforceRiskRewardRatio("open_long", 100, 95, 115); err != nil {
		t.Fatalf("3:1 long setup should pass: %v", err)
	}
	if err := at.enforceRiskRewardRatio("open_short", 100, 105, 85); err != nil {
		t.Fatalf("3:1 short setup should pass: %v", err)
	}
	if err := at.enforceRiskRewardRatio("open_long", 100, 95, 110); err == nil || !strings.Contains(err.Error(), "below 3.00:1") {
		t.Fatalf("expected live-price reward/risk rejection, got %v", err)
	}
}
