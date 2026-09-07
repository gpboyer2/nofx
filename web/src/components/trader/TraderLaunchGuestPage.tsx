import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Download,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react'
import { ROUTES } from '../../router/paths'

const setupSteps = [
  {
    title: '创建你的 NOFX 账户',
    detail: '你的账户集中保存 Autopilot 配置、钱包授权状态和交易面板。',
    icon: KeyRound,
    action: '创建账户',
    to: ROUTES.register,
  },
  {
    title: '充值 AI 费用钱包',
    detail:
      'NOFX 为 Claw402.ai 数据和模型调用准备了一个 Base USDC 钱包，该钱包与交易保证金相互独立。',
    icon: CircleDollarSign,
    action: '打开充值二维码',
    to: ROUTES.login,
    returnUrl: `${ROUTES.traders}?setup=claw402`,
  },
  {
    title: '授权 Hyperliquid',
    detail:
      '连接你的交易钱包，批准 NOFX Agent 和构建手续费。资金始终保留在你的 Hyperliquid 账户中。',
    icon: Wallet,
    action: '连接交易所',
    to: ROUTES.login,
    returnUrl: `${ROUTES.traders}?setup=hyperliquid`,
  },
  {
    title: '充值交易 USDC',
    detail:
      '在 Hyperliquid 上充值 USDC，然后启动 NOFX Autopilot。策略会自动创建并启动。',
    icon: Zap,
    action: '打开 Hyperliquid',
    href: 'https://app.hyperliquid.xyz/',
  },
]

const pipeline = [
  '读取 Claw402.ai 实时看板，美股优先于加密货币展示。',
  '加载每个候选标的的方向、方向历史以及成本/清算结构。',
  '用原始 OHLCV K 线进行确认，只有当信号足够强时才全仓 10 倍交易。',
]

export function TraderLaunchGuestPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-hidden bg-nofx-bg px-4 py-10 md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="grid gap-8 rounded-2xl border border-nofx-gold/20 bg-nofx-bg-lighter p-6 md:p-8 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-nofx-gold/25 bg-nofx-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-nofx-gold">
              <ShieldCheck className="h-3.5 w-3.5" />
              NOFX Autopilot
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-nofx-text md:text-5xl">
              一个策略，四步配置，然后开始交易。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-nofx-text-muted">
              NOFX 运行单一的 Claw402 驱动策略：看板、各市场详情、清算结构、K
              线、执行。无需选择策略，也无需手动挑选交易标的。
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to={ROUTES.login}
                onClick={() =>
                  sessionStorage.setItem(
                    'returnUrl',
                    `${ROUTES.traders}?setup=claw402`
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-nofx-gold px-5 py-3 text-sm font-bold text-white transition hover:bg-nofx-gold/90"
              >
                开始配置
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={ROUTES.register}
                className="inline-flex items-center justify-center rounded-xl border border-nofx-gold/20 bg-nofx-bg-deeper px-5 py-3 text-sm font-semibold text-nofx-text transition hover:border-nofx-gold/40 hover:bg-nofx-bg-deeper"
              >
                创建账户
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {setupSteps.map((step, index) => {
              const Icon = step.icon
              const cardClass =
                'group rounded-xl border border-nofx-gold/20 bg-nofx-bg-deeper p-4 text-left transition hover:border-nofx-gold/35 hover:bg-nofx-gold/[0.06]'
              const content = (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-nofx-gold/20 bg-nofx-gold/10 text-nofx-gold">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-xs text-nofx-text-muted">
                      0{index + 1}
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-nofx-text">
                    {step.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-nofx-text-muted">
                    {step.detail}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-nofx-gold transition group-hover:text-nofx-gold/80">
                    {step.action}
                    {step.href ? (
                      <ExternalLink className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </div>
                </>
              )

              if (step.href) {
                return (
                  <a
                    key={step.title}
                    href={step.href}
                    target="_blank"
                    rel="noreferrer"
                    className={cardClass}
                  >
                    {content}
                  </a>
                )
              }

              return (
                <Link
                  key={step.title}
                  to={step.to || ROUTES.login}
                  onClick={() => {
                    if (step.returnUrl) {
                      sessionStorage.setItem('returnUrl', step.returnUrl)
                    }
                  }}
                  className={cardClass}
                >
                  {content}
                </Link>
              )
            })}
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-nofx-gold/20 bg-nofx-bg-lighter p-5 md:grid-cols-[0.78fr_1.22fr] md:p-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-nofx-gold">
              还没有交易钱包？
            </div>
            <p className="mt-3 text-sm leading-6 text-nofx-text-muted">
              NOFX 不需要你的主钱包私钥。安装或解锁一个 EVM 钱包，用 USDC 为
              Hyperliquid 充值，登录后再授权 NOFX Agent。
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <a
              href="https://rabby.io/"
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-nofx-gold/20 bg-nofx-bg-deeper p-4 transition hover:border-nofx-gold/30 hover:bg-nofx-gold/[0.06]"
            >
              <Download className="mb-3 h-4 w-4 text-nofx-gold" />
              <div className="font-semibold text-nofx-text">安装 Rabby</div>
              <p className="mt-2 text-sm leading-6 text-nofx-text-muted">
                在连接 Hyperliquid 之前，先创建或导入一个 EVM 钱包。
              </p>
            </a>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-nofx-gold/20 bg-nofx-bg-deeper p-4 transition hover:border-nofx-gold/30 hover:bg-nofx-gold/[0.06]"
            >
              <ExternalLink className="mb-3 h-4 w-4 text-nofx-gold" />
              <div className="font-semibold text-nofx-text">MetaMask</div>
              <p className="mt-2 text-sm leading-6 text-nofx-text-muted">
                已经在使用 MetaMask 了？解锁后即可在 NOFX 内继续配置。
              </p>
            </a>
            <a
              href="https://app.hyperliquid.xyz/"
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-nofx-gold/20 bg-nofx-gold/10 p-4 transition hover:bg-nofx-gold/15"
            >
              <ExternalLink className="mb-3 h-4 w-4 text-nofx-gold" />
              <div className="font-semibold text-nofx-text">
                打开 Hyperliquid
              </div>
              <p className="mt-2 text-sm leading-6 text-nofx-text-muted">
                在那里充值 USDC。交易资金始终保留在你的 Hyperliquid 账户中。
              </p>
            </a>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-nofx-gold/20 bg-nofx-bg-lighter p-5 md:grid-cols-[0.72fr_1.28fr] md:p-6">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-nofx-gold">
              启动后会发生什么
            </div>
            <p className="mt-3 text-sm leading-6 text-nofx-text-muted">
              每个循环都走同样的生产流程。界面只需要你充值、授权和启动。
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {pipeline.map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-xl border border-nofx-gold/20 bg-nofx-bg-deeper p-4"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-nofx-success" />
                <p className="text-sm leading-6 text-nofx-text">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
