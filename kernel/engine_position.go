package kernel

import (
	"fmt"
	"nofx/logger"
	"nofx/market"
	"nofx/store"
)

// ============================================================================
// Decision Validation
// ============================================================================

func validateDecisions(decisions []Decision, account AccountInfo, riskControl store.RiskControlConfig, signalManagedExit bool) error {
	for i := range decisions {
		if err := validateDecisionForMode(&decisions[i], account, riskControl, signalManagedExit); err != nil {
			return fmt.Errorf("decision #%d validation failed: %w", i+1, err)
		}
	}
	return nil
}

func validateDecision(d *Decision, account AccountInfo, riskControl store.RiskControlConfig) error {
	return validateDecisionForMode(d, account, riskControl, false)
}

func validateDecisionForMode(d *Decision, account AccountInfo, riskControl store.RiskControlConfig, signalManagedExit bool) error {
	validActions := map[string]bool{
		"open_long":   true,
		"open_short":  true,
		"close_long":  true,
		"close_short": true,
		"hold":        true,
		"wait":        true,
	}

	if !validActions[d.Action] {
		return fmt.Errorf("invalid action: %s", d.Action)
	}

	if d.Action == "open_long" || d.Action == "open_short" {
		// Asset tiering for validation:
		//   - BTC/ETH crypto perps use the BTC/ETH tier (typically 5x equity).
		//   - Hyperliquid XYZ assets (US equities, commodities, forex) are
		//     also treated as the higher tier — they are not crypto altcoins
		//     and the user's quick-trade flow shows them at the higher cap,
		//     so the validator must match.
		//   - Everything else is altcoin (1x equity by default).
		maxLeverage := riskControl.AltcoinMaxLeverage
		posRatio := riskControl.AltcoinMaxPositionValueRatio
		maxPositionValue := account.TotalEquity * posRatio
		isMajor := d.Symbol == "BTCUSDT" || d.Symbol == "ETHUSDT" || market.IsXyzDexAsset(d.Symbol)
		if isMajor {
			maxLeverage = riskControl.BTCETHMaxLeverage
			posRatio = riskControl.BTCETHMaxPositionValueRatio
			maxPositionValue = account.TotalEquity * posRatio
		}

		if d.Leverage <= 0 {
			return fmt.Errorf("leverage must be greater than 0: %d", d.Leverage)
		}
		if d.Leverage > maxLeverage {
			logger.Infof("⚠️  [Leverage Fallback] %s leverage exceeded (%dx > %dx), auto-adjusting to limit %dx",
				d.Symbol, d.Leverage, maxLeverage, maxLeverage)
			d.Leverage = maxLeverage
		}
		if d.PositionSizeUSD <= 0 {
			return fmt.Errorf("position size must be greater than 0: %.2f", d.PositionSizeUSD)
		}

		minPositionSize := riskControl.MinPositionSize
		if minPositionSize <= 0 {
			minPositionSize = 12
		}
		if d.PositionSizeUSD < minPositionSize {
			return fmt.Errorf("%s opening amount too small (%.2f USDT), must be ≥%.2f USDT", d.Symbol, d.PositionSizeUSD, minPositionSize)
		}

		tolerance := maxPositionValue * 0.01
		if d.PositionSizeUSD > maxPositionValue+tolerance {
			switch {
			case d.Symbol == "BTCUSDT" || d.Symbol == "ETHUSDT":
				return fmt.Errorf("BTC/ETH single coin position value cannot exceed %.0f USDT (%.1fx account equity), actual: %.0f", maxPositionValue, posRatio, d.PositionSizeUSD)
			case market.IsXyzDexAsset(d.Symbol):
				return fmt.Errorf("%s position value cannot exceed %.0f USDT (%.1fx account equity), actual: %.0f", d.Symbol, maxPositionValue, posRatio, d.PositionSizeUSD)
			default:
				return fmt.Errorf("altcoin single coin position value cannot exceed %.0f USDT (%.1fx account equity), actual: %.0f", maxPositionValue, posRatio, d.PositionSizeUSD)
			}
		}

		minConfidence := riskControl.MinConfidence
		if minConfidence > 0 && d.Confidence < minConfidence {
			return fmt.Errorf("confidence too low (%d), must be ≥%d", d.Confidence, minConfidence)
		}

		maxMarginUsage := riskControl.MaxMarginUsage
		if maxMarginUsage > 0 && account.TotalEquity > 0 {
			requiredMargin := d.PositionSizeUSD / float64(d.Leverage)
			maxMargin := account.TotalEquity * maxMarginUsage
			if requiredMargin > maxMargin+maxMargin*0.01 {
				return fmt.Errorf("position margin %.2f USDT exceeds %.0f%% limit (%.2f USDT)", requiredMargin, maxMarginUsage*100, maxMargin)
			}
		}
		if d.StopLoss <= 0 {
			return fmt.Errorf("stop loss must be greater than 0")
		}
		if signalManagedExit {
			if d.TakeProfit != 0 {
				return fmt.Errorf("take profit must be 0 when exits are signal-managed")
			}
			return nil
		}
		if d.TakeProfit <= 0 {
			return fmt.Errorf("stop loss and take profit must be greater than 0")
		}

		if d.Action == "open_long" {
			if d.StopLoss >= d.TakeProfit {
				return fmt.Errorf("for long positions, stop loss price must be less than take profit price")
			}
		} else {
			if d.StopLoss <= d.TakeProfit {
				return fmt.Errorf("for short positions, stop loss price must be greater than take profit price")
			}
		}

		var entryPrice float64
		if d.Action == "open_long" {
			entryPrice = d.StopLoss + (d.TakeProfit-d.StopLoss)*0.2
		} else {
			entryPrice = d.StopLoss - (d.StopLoss-d.TakeProfit)*0.2
		}

		var riskPercent, rewardPercent, riskRewardRatio float64
		if d.Action == "open_long" {
			riskPercent = (entryPrice - d.StopLoss) / entryPrice * 100
			rewardPercent = (d.TakeProfit - entryPrice) / entryPrice * 100
			if riskPercent > 0 {
				riskRewardRatio = rewardPercent / riskPercent
			}
		} else {
			riskPercent = (d.StopLoss - entryPrice) / entryPrice * 100
			rewardPercent = (entryPrice - d.TakeProfit) / entryPrice * 100
			if riskPercent > 0 {
				riskRewardRatio = rewardPercent / riskPercent
			}
		}

		minRiskRewardRatio := riskControl.MinRiskRewardRatio
		if minRiskRewardRatio <= 0 {
			minRiskRewardRatio = 3
		}
		if riskRewardRatio < minRiskRewardRatio {
			return fmt.Errorf("risk/reward ratio too low (%.2f:1), must be ≥%.1f:1 [risk: %.2f%% reward: %.2f%%] [stop loss: %.2f take profit: %.2f]",
				riskRewardRatio, minRiskRewardRatio, riskPercent, rewardPercent, d.StopLoss, d.TakeProfit)
		}
	}

	return nil
}
