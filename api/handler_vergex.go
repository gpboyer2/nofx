package api

import (
	"context"
	"fmt"
	"net/http"
	"nofx/logger"
	"nofx/provider/vergex"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// retryAfterPattern extracts the upstream "retry_after" seconds (429 body:
// {"detail":"...","retry_after":53,"retryable":true}).
var retryAfterPattern = regexp.MustCompile(`retry_after":(\d+)`)

// vergexGatewayError logs an upstream vergex (claw402 x402 paid endpoint)
// failure and translates it into a user-actionable response. Wallet funding
// problems (no Base ETH/USDC) surface as upstream 429 payment suppression —
// those return 503 with a Chinese explanation and the upstream wait seconds;
// every other upstream fault stays a plain 502 with the original message.
func vergexGatewayError(c *gin.Context, label string, err error) {
	logger.Warnf("%s failed: %v", label, err)
	msg := err.Error()
	if strings.Contains(msg, "payment_retry_suppressed") || strings.Contains(msg, "status 429") {
		wait := 60
		if m := retryAfterPattern.FindStringSubmatch(msg); m != nil {
			if n, convErr := strconv.Atoi(m[1]); convErr == nil && n > 0 {
				wait = n
			}
		}
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": fmt.Sprintf("claw402 数据服务暂时拒绝请求：claw402 钱包的链上支付被上游限流（通常是钱包缺少 Base 网络的 ETH 手续费或 USDC 余额）。请先给 claw402 钱包充值，约 %d 秒后可重试。", wait),
		})
		return
	}
	if strings.Contains(msg, "insufficient") || strings.Contains(msg, "UNFUNDED") {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "claw402 钱包余额不足：需要 Base 主网的 USDC（数据付费）和少量 ETH（链上手续费），请先充值后再试。",
		})
		return
	}
	c.JSON(http.StatusBadGateway, gin.H{"error": msg})
}

func (s *Server) handleVergexDirectionChangeLeaderboard(c *gin.Context) {
	client, ok := s.newVergexClientForRequest(c)
	if !ok {
		return
	}
	data, err := client.GetDirectionChangeLeaderboard(c.Request.Context())
	if err != nil {
		vergexGatewayError(c, "Vergex direction-change leaderboard", err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", data.Raw)
}

func (s *Server) handleVergexDirectionChangeCurrent(c *gin.Context) {
	client, ok := s.newVergexClientForRequest(c)
	if !ok {
		return
	}
	symbol := strings.TrimSpace(c.Query("symbol"))
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 symbol 参数"})
		return
	}
	body, err := client.GetDirectionChangeCurrent(c.Request.Context(), symbol)
	if err != nil {
		vergexGatewayError(c, "Vergex direction-change current", err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

func (s *Server) handleVergexDirectionChangeHistory(c *gin.Context) {
	client, ok := s.newVergexClientForRequest(c)
	if !ok {
		return
	}
	symbol := strings.TrimSpace(c.Query("symbol"))
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 symbol 参数"})
		return
	}
	body, err := client.GetDirectionChangeHistory(
		c.Request.Context(), symbol, strings.TrimSpace(c.Query("type")),
		parsePositiveInt(c.Query("page"), 1), parsePositiveInt(c.Query("page_size"), 20),
	)
	if err != nil {
		if strings.Contains(err.Error(), "type must be") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		vergexGatewayError(c, "Vergex direction-change history", err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

func (s *Server) handleVergexCostLiquidationHeatmap(c *gin.Context) {
	client, ok := s.newVergexClientForRequest(c)
	if !ok {
		return
	}
	body, err := client.GetCostLiquidationHeatmap(context.Background(), vergex.Query{
		MarketType: withDefault(strings.TrimSpace(c.Query("marketType")), vergex.DefaultMarketType),
		Symbol:     strings.TrimSpace(c.Query("symbol")),
		Chain:      strings.TrimSpace(c.Query("chain")),
		LiqBand:    strings.TrimSpace(c.Query("liqBand")),
	})
	if err != nil {
		vergexGatewayError(c, "Vergex cost-liquidation-heatmap", err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

// handleVergexFlowMarkets proxies the Vergex net-flow market ranking (paid x402
// endpoint) using the caller's claw402 wallet. The upstream JSON is passed
// through verbatim: { data: { window, by, inflow: [{ symbol, netFlow,
// buyNotional, sellNotional, trades, latestPrice }, ...] } }.
func (s *Server) handleVergexFlowMarkets(c *gin.Context) {
	client, ok := s.newVergexClientForRequest(c)
	if !ok {
		return
	}
	chain := withDefault(strings.TrimSpace(c.Query("chain")), "mainnet")
	window := withDefault(strings.TrimSpace(c.Query("window")), "1h")
	limit := parsePositiveInt(c.Query("limit"), 25)

	body, err := client.GetFlowMarkets(context.Background(), chain, window, limit)
	if err != nil {
		vergexGatewayError(c, "Vergex flow-markets", err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", body)
}

func (s *Server) newVergexClientForRequest(c *gin.Context) (*vergex.Client, bool) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return nil, false
	}
	walletKey, err := s.resolveStrategyDataWalletKey(userID, c.Query("ai_model_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return nil, false
	}
	if walletKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "claw402 钱包未配置"})
		return nil, false
	}
	client, err := vergex.NewClient("", walletKey, &logger.MCPLogger{})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return nil, false
	}
	return client, true
}

func parsePositiveInt(raw string, fallback int) int {
	if raw == "" {
		return fallback
	}
	var n int
	if _, err := fmt.Sscanf(raw, "%d", &n); err != nil || n <= 0 {
		return fallback
	}
	return n
}

func withDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
