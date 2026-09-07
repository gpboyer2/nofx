import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CircleDollarSign,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../lib/api'
import { buildDashboardPath, ROUTES } from '../../router/paths'
import {
  ensureClaw402Strategy,
  launchAutopilot,
} from '../../lib/launch/launchAutopilot'
import { runLaunchPreflight } from '../../lib/launch/preflight'
import type { LaunchPreflightResult } from '../../lib/launch/types'
import type {
  AIModel,
  CurrentBeginnerWalletResponse,
  Exchange,
  ExchangeAccountState,
  TraderInfo,
} from '../../types'
import { HyperliquidWalletConnect } from '../common/HyperliquidWalletConnect'

type LaunchStepStatus = 'ready' | 'action' | 'blocked'

interface AutopilotLaunchPanelProps {
  models: AIModel[]
  exchanges: Exchange[]
  exchangeAccountStates: Record<string, ExchangeAccountState>
  traders?: TraderInfo[]
  isLoggedIn: boolean
  language: string
  onRefresh: () => Promise<void>
  onOpenClaw402Config?: () => void
  onOpenHyperliquidConfig?: () => void
}

const MIN_AI_FEE_USDC = 1
const MIN_TRADING_USDC = 12

function parseNumber(value?: string | number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Number(value.replace(/[,$\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function shortAddress(address?: string) {
  if (!address) return '--'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function formatUSDC(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} 已复制`)
  } catch {
    toast.error('复制失败')
  }
}

export function AutopilotLaunchPanel({
  models,
  exchanges,
  exchangeAccountStates,
  traders = [],
  isLoggedIn,
  language,
  onRefresh,
  onOpenClaw402Config,
  onOpenHyperliquidConfig,
}: AutopilotLaunchPanelProps) {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState<CurrentBeginnerWalletResponse | null>(
    null
  )
  const [walletLoading, setWalletLoading] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const isZh = language === 'zh'

  const claw402Model = useMemo(
    () =>
      models.find(
        (model) =>
          model.provider === 'claw402' &&
          model.enabled &&
          (model.has_api_key || model.apiKey || model.walletAddress)
      ) || null,
    [models]
  )

  const hyperliquidExchange = useMemo(
    () =>
      exchanges.find(
        (exchange) =>
          exchange.exchange_type === 'hyperliquid' &&
          exchange.enabled &&
          Boolean(exchange.hyperliquidWalletAddr) &&
          Boolean(exchange.hyperliquidBuilderApproved)
      ) || null,
    [exchanges]
  )

  // Any hyperliquid account (even partially configured) is enough for the
  // server preflight — it reports exactly which prerequisite is missing.
  const preflightExchange = useMemo(
    () =>
      hyperliquidExchange ||
      exchanges.find((exchange) => exchange.exchange_type === 'hyperliquid') ||
      null,
    [exchanges, hyperliquidExchange]
  )

  // Server-side preflight is the source of truth for balances: it queries the
  // chain / exchange live (30s server cache) instead of trusting the balance
  // snapshot cached in the model object. Poll while the panel is visible so
  // deposits show up without a manual refresh.
  const [preflight, setPreflight] = useState<LaunchPreflightResult | null>(null)
  const claw402ModelId = claw402Model?.id
  const preflightExchangeId = preflightExchange?.id
  useEffect(() => {
    if (!isLoggedIn || !claw402ModelId || !preflightExchangeId) {
      setPreflight(null)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const result = await runLaunchPreflight({
          ai_model_id: claw402ModelId,
          exchange_id: preflightExchangeId,
        })
        if (!cancelled) setPreflight(result)
      } catch {
        // keep the last known result; client-derived fallbacks still render
      }
    }
    void check()
    const timer = setInterval(() => void check(), 20000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [isLoggedIn, claw402ModelId, preflightExchangeId])

  const preflightCheck = (id: string) =>
    preflight?.checks.find((check) => check.id === id)

  const feeWalletAddress =
    claw402Model?.walletAddress ||
    wallet?.address ||
    preflightCheck('ai_wallet')?.address ||
    ''
  const feeFundsCheck = preflightCheck('ai_wallet_funds')
  const feeWalletBalance =
    feeFundsCheck?.actual ??
    parseNumber(claw402Model?.balanceUsdc || wallet?.balance_usdc)
  const minAIFeeUSDC = preflight?.min_ai_fee_usdc ?? MIN_AI_FEE_USDC
  const feeReady = feeFundsCheck
    ? feeFundsCheck.status !== 'failed' && Boolean(feeWalletAddress)
    : Boolean(feeWalletAddress) && feeWalletBalance >= minAIFeeUSDC

  const hyperliquidConnected = Boolean(hyperliquidExchange)
  const exchangeState = hyperliquidExchange
    ? exchangeAccountStates[hyperliquidExchange.id]
    : undefined
  const accountCheck = preflightCheck('exchange_account')
  const tradingFundsCheck = preflightCheck('exchange_funds')
  const tradingBalance =
    tradingFundsCheck?.actual ??
    parseNumber(exchangeState?.available_balance ?? exchangeState?.total_equity)
  const minTradingUSDC = preflight?.min_trading_usdc ?? MIN_TRADING_USDC
  const tradingBalanceReady =
    hyperliquidConnected &&
    (accountCheck && tradingFundsCheck
      ? accountCheck.status === 'ok' && tradingFundsCheck.status !== 'failed'
      : exchangeState?.status === 'ok' && tradingBalance >= minTradingUSDC)

  const autopilotTrader = useMemo(
    () =>
      traders.find((trader) => trader.trader_name === 'NOFX Autopilot') ||
      traders.find((trader) =>
        (trader.strategy_name || '').toLowerCase().includes('claw402')
      ) ||
      null,
    [traders]
  )

  const allReady = feeReady && hyperliquidConnected && tradingBalanceReady

  const loadWallet = async () => {
    setWalletLoading(true)
    try {
      setWallet(await api.getCurrentBeginnerWallet())
    } catch {
      setWallet(null)
    } finally {
      setWalletLoading(false)
    }
  }

  useEffect(() => {
    void loadWallet()
  }, [])

  const refreshEverything = async () => {
    setRefreshing(true)
    try {
      await Promise.all([onRefresh(), loadWallet()])
    } finally {
      setRefreshing(false)
    }
  }

  const handleLaunch = async () => {
    if (!claw402Model || !hyperliquidExchange) return
    setLaunching(true)
    try {
      // Shared launch path (same as Strategy Studio): server preflight with
      // fresh balances first, then strategy provisioning, then create/start.
      const outcome = await launchAutopilot({
        ensureStrategy: ensureClaw402Strategy,
        scanIntervalMinutes: 5,
      })

      if (!outcome.ok) {
        toast.error(outcome.message)
        if (outcome.kind === 'preflight') {
          setPreflight(outcome.preflight)
        }
        if (outcome.kind !== 'error') {
          if (outcome.setupTarget === 'claw402') {
            onOpenClaw402Config?.()
          } else if (outcome.setupTarget === 'hyperliquid') {
            onOpenHyperliquidConfig?.()
          }
        }
        await refreshEverything()
        return
      }

      if (outcome.warning) {
        toast.warning(outcome.warning)
      }
      await onRefresh()
      toast.success('NOFX Autopilot 正在运行')
      navigate(buildDashboardPath(outcome.traderId))
    } finally {
      setLaunching(false)
    }
  }

  const steps: Array<{
    title: string
    detail: string
    status: LaunchStepStatus
    meta?: string
    action?: JSX.Element
  }> = [
    {
      title: '步骤 1 · 为 AI 钱包充值（$1+）',
      detail:
        'AI 每次思考都会支付少量手续费。从 Binance、OKX、Coinbase 或任意钱包，向该地址转入价值 $1 以上的 USDC（Base 网络）。这笔钱和你的交易资金是分开的。',
      status: feeReady ? 'ready' : 'action',
      meta: feeWalletAddress
        ? `${shortAddress(feeWalletAddress)} · ${formatUSDC(feeWalletBalance)} USDC${
            feeReady ? '' : ` · 需要 ≥ ${minAIFeeUSDC} USDC`
          }`
        : '只需 1 分钟——我们帮你创建钱包',
      action: feeWalletAddress ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.welcome)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-nofx-gold hover:text-nofx-accent"
          >
            <CircleDollarSign className="h-3.5 w-3.5" />
            充值
          </button>
          <button
            type="button"
            onClick={() => void copyText(feeWalletAddress, 'AI 手续费钱包')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-nofx-gold hover:text-nofx-accent"
          >
            <Copy className="h-3.5 w-3.5" />
            复制
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate(ROUTES.welcome)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-nofx-gold hover:text-nofx-accent"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          创建
        </button>
      ),
    },
    {
      title: '步骤 2 · 连接 Hyperliquid',
      detail:
        '用你的加密货币钱包（Rabby 或 MetaMask）一次性授权 NOFX。授权后 AI 就能替你下单交易——但它无法转走你的资金。',
      status: hyperliquidConnected ? 'ready' : 'action',
      meta: hyperliquidExchange?.hyperliquidWalletAddr
        ? `${shortAddress(hyperliquidExchange.hyperliquidWalletAddr)} · 已授权`
        : '点击几下 + 3 次钱包签名',
      action: (
        <button
          type="button"
          onClick={() => onOpenHyperliquidConfig?.()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-nofx-gold hover:text-nofx-accent"
        >
          <Wallet className="h-3.5 w-3.5" />
          打开
        </button>
      ),
    },
    {
      title: '步骤 3 · 添加交易资金（$12+）',
      detail:
        '向你的 Hyperliquid 账户存入 USDC（app.hyperliquid.xyz → 充值，Arbitrum 网络 USDC）。这是 AI 用来交易的资金——起步可以少充，随时可以追加。',
      status: tradingBalanceReady
        ? 'ready'
        : hyperliquidConnected
          ? 'action'
          : 'blocked',
      meta: hyperliquidConnected
        ? `${formatUSDC(tradingBalance)} USDC 可用${
            tradingBalanceReady ? '' : ` · 需要 ≥ ${minTradingUSDC} USDC`
          }`
        : '先完成步骤 2',
    },
    {
      title: '步骤 4 · 启动',
      detail:
        'AI 每隔几分钟就会分析市场、自主选仓并管理交易。在仪表盘上实时查看每个决策——随时一键停止。',
      status: allReady ? 'ready' : 'blocked',
      meta: autopilotTrader?.is_running
        ? '运行中——打开仪表盘查看'
        : autopilotTrader
          ? '准备就绪'
          : allReady
            ? '一切就绪，点击按钮即可'
            : '完成步骤 1-3 后解锁',
    },
  ]

  const renderPrimaryAction = () => {
    if (!feeReady) {
      return (
        <button
          type="button"
          onClick={() => navigate(ROUTES.welcome)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nofx-gold px-4 py-3 text-sm font-bold text-white hover:bg-nofx-accent"
        >
          配置 AI 钱包
          <ArrowRight className="h-4 w-4" />
        </button>
      )
    }

    if (!hyperliquidConnected) {
      return (
        <button
          type="button"
          onClick={() => {
            if (onOpenHyperliquidConfig) {
              onOpenHyperliquidConfig()
            } else {
              document
                .getElementById('hyperliquid-quick-connect')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nofx-gold px-4 py-3 text-sm font-bold text-white hover:bg-nofx-accent"
        >
          连接 Hyperliquid
          <ArrowRight className="h-4 w-4" />
        </button>
      )
    }

    if (!tradingBalanceReady) {
      return (
        <a
          href="https://app.hyperliquid.xyz/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nofx-gold px-4 py-3 text-sm font-bold text-white hover:bg-nofx-accent"
        >
          在 Hyperliquid 充值 USDC
          <ExternalLink className="h-4 w-4" />
        </a>
      )
    }

    if (autopilotTrader?.is_running) {
      return (
        <button
          type="button"
          onClick={() =>
            navigate(buildDashboardPath(autopilotTrader.trader_id))
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nofx-success px-4 py-3 text-sm font-bold text-white hover:bg-nofx-success/80"
        >
          打开仪表盘
          <ArrowRight className="h-4 w-4" />
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={() => void handleLaunch()}
        disabled={launching || !allReady}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-nofx-gold px-4 py-3 text-sm font-bold text-white hover:bg-nofx-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {launching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4" />
        )}
        启动 NOFX Autopilot
      </button>
    )
  }

  return (
    <section
      id="autopilot-launch-panel"
      className="overflow-hidden rounded-xl border border-nofx-gold/20 bg-nofx-bg-lighter"
    >
      <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-nofx-gold/25 bg-nofx-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-nofx-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                引导启动
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-nofx-text md:text-3xl">
                几分钟内启动 NOFX Autopilot
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-nofx-text-muted">
                四个小步骤，总计约 $13。无需 API Key，无需配置文件 —— AI
                替你交易，随时可以停止。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void refreshEverything()}
                disabled={refreshing || walletLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-nofx-gold/20 bg-nofx-bg-deeper px-3 py-2 text-xs font-semibold text-nofx-text-muted hover:text-nofx-text disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing || walletLoading ? 'animate-spin' : ''}`}
                />
                刷新
              </button>
              {renderPrimaryAction()}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border border-nofx-gold/20 bg-nofx-bg p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                      step.status === 'ready'
                        ? 'border-nofx-success/30 bg-nofx-success/15 text-nofx-success'
                        : step.status === 'action'
                          ? 'border-nofx-gold/30 bg-nofx-gold/15 text-nofx-gold'
                          : 'border-nofx-gold/20 bg-nofx-bg-deeper text-nofx-text-muted'
                    }`}
                  >
                    {step.status === 'ready' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : step.status === 'action' ? (
                      index + 1
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-nofx-text">
                        {step.title}
                      </h3>
                      {step.action}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-nofx-text-muted">
                      {step.detail}
                    </p>
                    <div className="mt-3 font-mono text-xs text-nofx-gold/90">
                      {step.meta}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-nofx-gold/20 bg-nofx-bg p-5 md:p-6 xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-nofx-text">
            <Wallet className="h-4 w-4 text-nofx-gold" />
            Hyperliquid 配置
          </div>
          {hyperliquidConnected ? (
            <div className="rounded-lg border border-nofx-success/25 bg-nofx-success/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-nofx-success">
                <CheckCircle2 className="h-4 w-4" />
                交易授权已就绪
              </div>
              <div className="mt-2 font-mono text-xs text-nofx-success/90">
                {shortAddress(hyperliquidExchange?.hyperliquidWalletAddr)}
              </div>
              <p className="mt-3 text-xs leading-5 text-nofx-text-muted">
                资金始终留在你的 Hyperliquid 账户中。NOFX
                仅存储自动化执行所需的授权 Agent 密钥。
              </p>
            </div>
          ) : (
            <div>
              <div id="hyperliquid-quick-connect">
                <HyperliquidWalletConnect
                  language={isZh ? 'zh' : 'en'}
                  isLoggedIn={isLoggedIn}
                  variant="inline"
                  onSaved={refreshEverything}
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
