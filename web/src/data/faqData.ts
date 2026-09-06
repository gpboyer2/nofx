import {
  BookOpen,
  GitBranch,
  Monitor,
  Shield,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * FAQ content model. Answers are composed from typed blocks so the renderer
 * stays generic — no per-question JSX special cases. Inline `code` spans are
 * written with backticks and parsed by the renderer.
 */
export type FAQBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'links'; links: { label: string; href: string }[] }

export interface FAQItem {
  id: string
  question: string
  blocks: FAQBlock[]
}

export interface FAQCategory {
  id: string
  title: string
  icon: LucideIcon
  items: FAQItem[]
}

/** Plain text of an item, used by the search filter. */
export function faqItemSearchText(item: FAQItem): string {
  const parts: string[] = [item.question]
  for (const block of item.blocks) {
    if (block.type === 'p' || block.type === 'note') parts.push(block.text)
    else if (block.type === 'list' || block.type === 'steps')
      parts.push(block.items.join(' '))
    else if (block.type === 'links')
      parts.push(block.links.map((l) => l.label).join(' '))
  }
  return parts.join(' ').toLowerCase()
}

export const faqCategories: FAQCategory[] = [
  // ───────────────────────── Getting started ─────────────────────────
  {
    id: 'getting-started',
    title: '入门指南',
    icon: BookOpen,
    items: [
      {
        id: 'what-is-nofx',
        question: 'NOFX 是什么？',
        blocks: [
          {
            type: 'p',
            text: 'NOFX 是一个开源的、可自托管的 AI 交易终端。其旗舰模式是 NOFX 自动驾驶：一个 AI agent，它会读取 Claw402.ai 信号板，用 Signal Lab 和平仓结构验证候选标的，用原始 K 线确认入场时机，然后在 Hyperliquid 上执行交易——这一切都在你自己的机器上完成，你的密钥永远不会离开你的服务器。',
          },
          {
            type: 'p',
            text: '除了自动驾驶模式，你还可以在策略工作室（Strategy Studio）中构建自定义策略，同时运行多个 AI 交易员，并在排行榜上对比它们的表现。',
          },
        ],
      },
      {
        id: 'what-do-i-need',
        question: '启动自动驾驶之前我需要准备什么？',
        blocks: [
          {
            type: 'p',
            text: '两个已充值资金的账户——配置页面的引导式启动会带你逐步完成：',
          },
          {
            type: 'list',
            items: [
              '一个 AI 付费钱包：Base 链上的 USDC 钱包，用于支付 AI 模型和行情数据调用的费用。启动最低需要 `1 USDC`。',
              '一个 Hyperliquid 账户，已授权交易权限，且至少有 `12 USDC` 可用作保证金。',
            ],
          },
          {
            type: 'p',
            text: '启动按钮会运行服务端的前置检查，逐项验证所有先决条件，并精确定位还缺哪一步，因此你不可能启动一个配置不完整的交易机器人。',
          },
        ],
      },
      {
        id: 'which-markets',
        question: '它可以交易哪些市场？',
        blocks: [
          {
            type: 'p',
            text: '自动驾驶交易的是 Hyperliquid 永续合约：主流加密货币（BTC、ETH、SOL 等）加上 xyz 合成市场，覆盖美股、指数、大宗商品和外汇——一个账户就能让 AI 拥有多资产的交易宇宙。',
          },
          {
            type: 'p',
            text: '在策略工作室中创建的还可以手动连接 Binance、Bybit、OKX、Bitget、KuCoin、Gate、Aster 和 Lighter。',
          },
        ],
      },
      {
        id: 'ai-models',
        question: '它使用哪些 AI 模型？我需要 API Key 吗？',
        blocks: [
          {
            type: 'p',
            text: '不需要 API Key。NOFX 通过 Claw402 按量付费的基础设施进行推理：你的 AI 付费钱包用 Base 上的 USDC 按次付费，终端按需访问支持的模型（DeepSeek 等前沿模型）。',
          },
          {
            type: 'p',
            text: '高级用户仍然可以在"配置 → 模型"中添加自己的服务商密钥（OpenAI、Claude、Gemini、DeepSeek、Qwen、Grok、Kimi 或任何兼容 OpenAI 的接口）。',
          },
        ],
      },
      {
        id: 'is-it-profitable',
        question: '它能赚钱吗？',
        blocks: [
          {
            type: 'p',
            text: '没有人能保证这一点，任何声称能保证的人都不值得信任。AI 交易的是一个系统化的流程，但市场充满博弈，过去的业绩从不代表未来的结果。',
          },
          {
            type: 'p',
            text: '仪表盘对业绩的展示是实事求是的：它将已实现盈亏和未实现盈亏分开，展示费用拖累链条（毛利润 − 费用 = 净利润）、盈亏因子和根据你的真实起始资金计算的最大回撤。关注这些数字，从小资金开始，只交易你亏得起的钱。',
          },
          {
            type: 'note',
            text: '交易涉及重大亏损风险。NOFX 是软件，不是投资建议。',
          },
        ],
      },
    ],
  },

  // ───────────────────────── Launch & wallets ─────────────────────────
  {
    id: 'launch-wallets',
    title: '启动与钱包',
    icon: Zap,
    items: [
      {
        id: 'ai-fee-wallet',
        question: '什么是 AI 付费钱包？',
        blocks: [
          {
            type: 'p',
            text: '这是在 Base 链上专用的 EVM 钱包，用于支付 AI 模型调用和付费行情数据（x402 微支付）。它与你用于交易的保证金完全隔离——永远不会触及 Hyperliquid。',
          },
          {
            type: 'list',
            items: [
              '引导式设置会帮你创建一个（或复用已有的）。',
              '只向其地址转入 Base 网络上的 USDC。',
              '启动至少需要 `1 USDC`；充值后余额显示会自动刷新。',
              '一个典型交易周期花费从零点几美分到几美分不等，取决于所使用的模型。',
            ],
          },
        ],
      },
      {
        id: 'fee-wallet-private-key',
        question: 'AI 付费钱包的私钥保存在哪里？',
        blocks: [
          {
            type: 'p',
            text: '私钥在你的服务器上本地生成，以 AES-256 加密存储在你自己的数据库中，并在首次设置页面中展示给你一次。务必备份——如果数据库丢失就无法恢复。',
          },
          {
            type: 'note',
            text: '钱包里只放用于付费的少量资金。它的存在是为了支付 AI 调用，不是用来存钱的。',
          },
        ],
      },
      {
        id: 'hyperliquid-authorization',
        question: 'Hyperliquid 的授权是如何工作的？安全吗？',
        blocks: [
          {
            type: 'p',
            text: 'NOFX 使用 Hyperliquid 的 agent 钱包机制，因此你的主钱包私钥永远不会被共享。连接流程包含四个签名步骤：',
          },
          {
            type: 'steps',
            items: [
              '连接你的 EVM 钱包（Rabby、MetaMask、OKX、Coinbase Wallet）。',
              '批准一个新生成的 NOFX agent 钱包——有效期 180 天，仅限交易操作。',
              '批准 builder 费用（一小笔按订单收取的平台运营费）。',
              '将 agent 密钥保存到你的 NOFX 服务器（加密存储）。',
            ],
          },
          {
            type: 'p',
            text: 'agent 钱包只能开仓和平仓，不能做其他任何操作。它无法提取资金，你的保证金始终留在你自己的 Hyperliquid 账户中。',
          },
        ],
      },
      {
        id: 'launch-preflight',
        question: '启动前置检查都查什么？',
        blocks: [
          {
            type: 'p',
            text: '在任何操作或变更之前，服务器会使用实时数据验证完整链路：',
          },
          {
            type: 'list',
            items: [
              'AI 模型已启用且拥有凭据。',
              'AI 付费钱包密钥有效且 Base 上的 USDC 余额至少为 `1 USDC`（链上查询）。',
              'Hyperliquid 账户已授权（agent + builder 费用）且可访问。',
              '交易资金：含持仓权益在内至少有 `12 USDC`。',
            ],
          },
          {
            type: 'p',
            text: '每个失败的检查都会指明具体的修复步骤并跳转到对应的设置页面。同样的检查在每次启动时都会在服务端强制执行，因此不可能绕过。',
          },
        ],
      },
      {
        id: 'relaunch-behavior',
        question: '如果我再次按启动会怎样？',
        blocks: [
          {
            type: 'p',
            text: '启动是幂等的。如果 NOFX 自动驾驶已经存在，启动器会用当前策略配置更新它并重新启动——绝不会出现重复创建。如果机器人正在执行一个交易周期，重启可能需要最多一分钟；界面会等待它完成。',
          },
        ],
      },
      {
        id: 'deposit-not-showing',
        question: '我充了 USDC 但余额仍然显示为零。',
        blocks: [
          {
            type: 'list',
            items: [
              'AI 付费钱包：确认你是在 Base 网络上向显示的精确地址转入的 USDC。余额缓存约为 30 秒，设置面板会自动每隔几秒重新检查。',
              'Hyperliquid：充值会进入你自己的 Hyperliquid 账户；余额步骤会轮询实时账户状态。如有疑问可在引导面板中使用刷新按钮。',
              '如果链上 RPC 暂时不可用，面板会将余额标记为未知而不是零——等一分钟再试。',
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────── Trading & execution ─────────────────────────
  {
    id: 'trading',
    title: '交易执行',
    icon: TrendingUp,
    items: [
      {
        id: 'autopilot-pipeline',
        question: '自动驾驶策略是如何逐步工作的？',
        blocks: [
          {
            type: 'p',
            text: '每个周期运行相同的四阶段漏斗——每个阶段都可能拒绝候选标的，只有通过全部四个阶段的交易设定才会被执行：',
          },
          {
            type: 'steps',
            items: [
              '构建标的池——拉取实时的 Claw402.ai 排名，从主流加密货币和 xyz 合成市场（美股、指数、大宗商品、外汇）中选取排名靠前的候选标的（默认 10 个），每个标的带有方向性倾向和信号 z 分值。',
              '验证每个候选标的——获取其 Signal Lab 深度信号以及价格周围的费用/平仓结构：平仓集群和成本基础可以显示一段行情在运行中前方是否有燃料支撑，或者是否存在阻力墙。',
              '确认时机——读取原始 15 分钟 OHLCV K 线（30 根）来确认入场是顺势而为，而非追高。',
              '决策与仓位管理——只有通过置信度阈值（默认 `78/100`）且盈亏比大约为 `3:1` 的交易设定才会在 10 倍杠杆下建仓；平仓总在开仓之前执行，每个周期都会同时考虑多头和空头两个方向。',
            ],
          },
          {
            type: 'p',
            text: '还有第五层完全独立于 AI 之外：硬性风控参数（仓位上限、杠杆上限、保证金上限、交易节流器）会拒绝任何违反规则的决策，无论模型多有信心。',
          },
        ],
      },
      {
        id: 'data-sources',
        question: '使用哪些数据，哪些是付费的？',
        blocks: [
          {
            type: 'list',
            items: [
              'Claw402.ai 信号数据——排名板、每个交易对的 Signal Lab 深度信号和市场资金流向。这些是付费接口，按次用你 AI 付费钱包中的 USDC 计费（x402 微支付）。',
              '费用/平仓热力图——每个市场的聚合持仓成本和平仓集群结构。',
              'Hyperliquid 行情数据——原始 OHLCV K 线和实时 L2 订单簿（免费公开数据）。',
              '你的账户信息（通过 agent 钱包）——权益、可用保证金、持仓及 PnL。',
              '自己的历史记录——已平仓交易为下一步 prompt 提供胜率、盈亏因子和回撤数据，让 AI 了解自己最近的表现。',
            ],
          },
          {
            type: 'note',
            text: '仪表盘对付费 Claw402 接口的轮询频率较低（每隔几分钟）以节省你的费用——行情面板则通过免费数据源保持实时更新。',
          },
        ],
      },
      {
        id: 'decision-cycle',
        question: 'AI 多久做一次决策？',
        blocks: [
          {
            type: 'p',
            text: '自动驾驶根据你的启动配置，每 5 到 15 分钟运行一个扫描周期（可按每个交易员单独配置，最短 3 分钟）。第一个周期在启动后立即开始；单个周期通常需要 30 到 60 秒，因为 AI 在决策前要阅读完整的市场上下文。',
          },
        ],
      },
      {
        id: 'what-ai-sees',
        question: '每个周期 AI 都能看到什么信息？',
        blocks: [
          {
            type: 'list',
            items: [
              '你的账户：权益、可用保证金、持仓及 PnL。',
              'Claw402 排名板：候选标的池及方向性倾向。',
              '每个候选标的的 Signal Lab 深度信号和费用/平仓结构。',
              '用于确认时机的原始 OHLCV K 线。',
              '它自己的交易记录：胜率、盈亏因子、回撤、近期交易。',
            ],
          },
          {
            type: 'p',
            text: '每个周期都作为一条决策记录保存——仪表盘上的"执行日志"面板展示了推理链路、执行动作和被拒绝的订单。',
          },
        ],
      },
      {
        id: 'leverage-and-risk',
        question: '它使用什么杠杆和风控机制？',
        blocks: [
          {
            type: 'p',
            text: '自动驾驶默认使用 10 倍全仓杠杆。硬性风控在 AI 之外运行，AI 无法覆盖它们：',
          },
          {
            type: 'list',
            items: [
              '策略配置中的仓位数量上限——达到上限时新开仓会被拒绝。',
              '按资产类别设置的杠杆限制（BTC/ETH 与山寨币区别对待）。',
              '交易节流器防止频繁交易，例如在开仓几分钟后就平仓几乎没有盈利的头寸。',
              '安全模式（见下文）在 AI 自身故障时保护持仓。',
            ],
          },
        ],
      },
      {
        id: 'safe-mode',
        question: '什么是安全模式？',
        blocks: [
          {
            type: 'p',
            text: '如果 AI 连续 3 个周期决策失败（服务商断线、付费钱包空了、返回异常），交易员会进入安全模式：不再开新仓，已有仓位保持风控保护，循环继续重试。下一次 AI 调用成功后自动退出安全模式。',
          },
          {
            type: 'p',
            text: '安全模式会在仪表盘上以横幅形式显示，同时显示触发原因，因此绝不会悄无声息地发生。',
          },
        ],
      },
      {
        id: 'fee-wallet-empty-mid-run',
        question: '运行中 AI 付费钱包没钱了会怎样？',
        blocks: [
          {
            type: 'p',
            text: 'AI 调用开始失败，状态显示明确的"余额不足"。仪表盘会持续显示红色横幅并附带钱包余额。连续三个周期失败后，机器人进入安全模式。向付费钱包充入 Base 上的 USDC，交易员会自动恢复——无需重启。',
          },
        ],
      },
      {
        id: 'trading-fees',
        question: '我需要支付哪些费用？',
        blocks: [
          {
            type: 'list',
            items: [
              '每笔订单的 Hyperliquid 交易手续费，外加已批准的 builder 费用。',
              '从付费钱包按次支付的 AI/数据费用（每周期几美分）。',
            ],
          },
          {
            type: 'p',
            text: '费用是高频策略的隐形杀手。仪表盘的统计数据区展示了完整的链条——已实现毛利润，减去费用，等于净利润——这样你就能直观看到费用是否正在蚕食你的策略优势。',
          },
        ],
      },
      {
        id: 'stop-and-manual',
        question: '如何停止机器人或手动平仓？',
        blocks: [
          {
            type: 'list',
            items: [
              '停止：使用配置页面交易员列表中的停止按钮。停止会暂停决策循环；已开仓的仓位保持不变，由你自行管理。',
              '手动平仓：通过仪表盘上的仓位面板——手动平仓会同步到仓位历史记录中。',
              '紧急情况：你随时可以直接在 Hyperliquid 上管理仓位；NOFX 从不会锁死你自己的账户。',
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────── Dashboard & metrics ─────────────────────────
  {
    id: 'dashboard',
    title: '仪表盘与指标',
    icon: Monitor,
    items: [
      {
        id: 'metrics-meaning',
        question: '顶部的各项指标分别是什么意思？',
        blocks: [
          {
            type: 'list',
            items: [
              '权益（Equity）——包含未实现盈亏的实时账户价值。',
              '总盈亏（含未实现）——权益与你的起始资金对比；随持仓波动而变动。',
              '已实现盈亏（已平仓交易）——只统计已完成交易的净结果；胜率、盈亏因子和夏普比率都基于此计算。',
              '盈亏因子——已平仓交易的毛盈利 ÷ 毛亏损；大于 1.0 表示已平仓部分总体盈利。',
              '最大回撤——已实现权益曲线从峰值到谷底的最大跌幅，基于你的真实起始资金计算。',
            ],
          },
        ],
      },
      {
        id: 'pl-contradiction',
        question: '为什么总盈亏是正的但已实现盈亏是负的？',
        blocks: [
          {
            type: 'p',
            text: '它们衡量的是不同的事情。已实现盈亏只统计已平仓的交易；总盈亏还包括当前未平仓头寸的未实现盈利。一个机器人已平仓部分可能亏损，但其持仓中有足够多的未实现盈利使得总盈亏为正——反之亦然。查看毛利润/费用/净利润数据区，了解已实现结果中有多少被费用吃掉了。',
          },
        ],
      },
      {
        id: 'execution-log',
        question: '在哪里能看到 AI 为什么做了（或拒绝）某件事？',
        blocks: [
          {
            type: 'p',
            text: '执行日志面板列出了每个周期的执行动作、AI 调用耗时、以及被拒绝的订单和触发拦截的具体原因（节流器、仓位上限、风控规则等）。完整的推理链路随每条决策记录一起存储。',
          },
        ],
      },
      {
        id: 'competition',
        question: '排行榜/竞赛是什么？',
        blocks: [
          {
            type: 'p',
            text: '启用"在比赛中显示"的交易员会出现在公开排行榜上，按实时业绩排名。这个功能是可选的，可以随时在交易员列表中开关。',
          },
        ],
      },
    ],
  },

  // ───────────────────────── Security ─────────────────────────
  {
    id: 'security',
    title: '安全',
    icon: Shield,
    items: [
      {
        id: 'key-storage',
        question: '我的密钥是如何存储的？',
        blocks: [
          {
            type: 'list',
            items: [
              '所有密钥（agent 密钥、付费钱包密钥、交易所 API 密钥）在你的数据库中以 AES-256 加密静态存储。',
              '可选的 RSA 传输加密保护浏览器和服务器之间传输中的密钥安全。',
              'NOFX 是自托管的：不会向任何第三方服务器发送任何内容。代码开源且可审计。',
            ],
          },
        ],
      },
      {
        id: 'can-nofx-steal-funds',
        question: 'NOFX 能提走或偷我的资金吗？',
        blocks: [
          {
            type: 'p',
            text: '不能。在 Hyperliquid 上，NOFX 只持有 agent 钱包，该钱包按协议设计只能交易，不能提现。你的保证金始终留在你自己的账户中，由你主钱包控制。',
          },
          {
            type: 'note',
            text: '如果你连接的是中心化交易所（CEX），请只创建交易权限的 API Key——关闭提现功能并设置 IP 白名单。',
          },
        ],
      },
      {
        id: 'registration-model',
        question: '为什么其他人不能在我的实例上注册？',
        blocks: [
          {
            type: 'p',
            text: '按设计，一个实例是单操作员模式：第一个注册的账户成为操作员，注册功能随即关闭（"系统已初始化"）。这防止了陌生人通过暴露的部署创建账户。每个操作员应运行一个独立实例。',
          },
        ],
      },
    ],
  },

  // ───────────────────────── Self-hosting ─────────────────────────
  {
    id: 'self-hosting',
    title: '自托管与故障排除',
    icon: Wrench,
    items: [
      {
        id: 'how-to-install',
        question: '如何安装 NOFX？',
        blocks: [
          {
            type: 'p',
            text: '在 Linux/macOS 上运行一行命令（通过 Docker 安装并启动所有组件）：',
          },
          {
            type: 'list',
            items: [
              '脚本：`curl -fsSL https://raw.githubusercontent.com/NoFxAiOS/nofx/main/install.sh | bash`',
              'Docker：下载 `docker-compose.prod.yml` 然后运行 `docker compose -f docker-compose.prod.yml up -d`',
              'Windows：安装 Docker Desktop，然后使用上面的 Docker 方式。',
              '从源码安装：Go 1.21+、Node 18+、TA-Lib（`brew install ta-lib` / `apt-get install libta-lib0-dev`），然后运行 `go run .` 和 `npm --prefix web run dev`。',
            ],
          },
          {
            type: 'p',
            text: '然后打开 `http://127.0.0.1:3000`——Web 界面在 3000 端口，API 在 8080 端口。',
          },
        ],
      },
      {
        id: 'how-to-update',
        question: '如何更新？',
        blocks: [
          {
            type: 'p',
            text: '重新运行安装脚本，或者使用 Docker：`docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`。你的数据库和密钥存储在挂载的 `data/` 目录中，更新不会丢失。后端重启后运行中的交易员会自动重新启动。',
          },
        ],
      },
      {
        id: 'launch-blocked',
        question: '启动被某项检查阻止了——怎么办？',
        blocks: [
          {
            type: 'p',
            text: '阅读提示信息：每个前置检查失败都会指明修复方法并引导你到正确的设置步骤——给 AI 钱包充值、完成 Hyperliquid 授权、或充值交易用的 USDC。余额会被实时重新检查，修复后就能正常启动。',
          },
        ],
      },
      {
        id: 'exchange-unreachable',
        question: '交易所账户显示"凭据无效"或"不可用"。',
        blocks: [
          {
            type: 'list',
            items: [
              '凭据无效：agent 授权已过期（180 天）或保存的密钥已失效——重新连接 Hyperliquid 钱包；流程中提供一键续期。',
              '不可用：交易所 API 没有响应；账户状态缓存 30 秒，等待后刷新即可。',
              'CEX 密钥：确认交易权限、IP 白名单以及合约/永续交易权限已开启。',
            ],
          },
        ],
      },
      {
        id: 'where-are-logs',
        question: '日志在哪里查看？',
        blocks: [
          {
            type: 'list',
            items: [
              '后端：`docker logs nofx-trading`（或运行 `go run .` 的终端）。',
              '每个周期的 AI 推理和错误：仪表盘的执行日志。',
              '前端构建/运行问题：浏览器开发者工具控制台。',
            ],
          },
        ],
      },
      {
        id: 'port-conflicts',
        question: '3000 或 8080 端口已被占用。',
        blocks: [
          {
            type: 'p',
            text: '停止冲突的服务，或者在 compose 文件中修改端口映射（例如前端 `"3100:80"`、API `"8180:8080"`），然后重启容器。',
          },
        ],
      },
    ],
  },

  // ───────────────────────── Contributing ─────────────────────────
  {
    id: 'contributing',
    title: '贡献',
    icon: GitBranch,
    items: [
      {
        id: 'how-to-contribute',
        question: '如何贡献代码？',
        blocks: [
          {
            type: 'links',
            links: [
              {
                label: '路线图',
                href: 'https://github.com/orgs/NoFxAiOS/projects/3',
              },
              {
                label: '任务面板',
                href: 'https://github.com/orgs/NoFxAiOS/projects/5',
              },
              {
                label: 'CONTRIBUTING.md',
                href: 'https://github.com/NoFxAiOS/nofx/blob/dev/CONTRIBUTING.md',
              },
            ],
          },
          {
            type: 'steps',
            items: [
              '从上面的面板中选择一个任务（按 good first issue / help wanted 筛选），然后留言 "assign me"。',
              'Fork 仓库并从 `dev` 分支创建新分支：`git checkout -b feat/your-topic`。',
              '遵循 Conventional Commits 规范；推送前运行 `npm --prefix web run lint && npm --prefix web run build`。',
              '向 `NoFxAiOS/nofx:dev` 提交 PR，引用对应 issue（`Closes #123`），UI 变更请附上截图。',
            ],
          },
        ],
      },
      {
        id: 'bounty-program',
        question: '有赏金计划吗？',
        blocks: [
          {
            type: 'p',
            text: '有——选定的 issue 有现金奖励，常规贡献者还能获得徽章、优先审核和 beta 测试资格。',
          },
          {
            type: 'links',
            links: [
              {
                label: '带赏金标签的 issue',
                href: 'https://github.com/NoFxAiOS/nofx/labels/bounty',
              },
              {
                label: '赏金领取模板',
                href: 'https://github.com/NoFxAiOS/nofx/blob/dev/.github/ISSUE_TEMPLATE/bounty_claim.md',
              },
            ],
          },
        ],
      },
      {
        id: 'report-bugs',
        question: '如何报告 bug？',
        blocks: [
          {
            type: 'p',
            text: '用模板开一个 GitHub issue：你做了什么、发生了什么、后端日志（`docker logs nofx-trading`）以及截图。如果是疑似安全问题，请遵循 SECURITY.md 中的负责任披露流程，不要公开发 issue。',
          },
          {
            type: 'links',
            links: [
              {
                label: '新建 issue',
                href: 'https://github.com/NoFxAiOS/nofx/issues/new/choose',
              },
              {
                label: 'SECURITY.md',
                href: 'https://github.com/NoFxAiOS/nofx/blob/dev/SECURITY.md',
              },
            ],
          },
        ],
      },
    ],
  },
]
