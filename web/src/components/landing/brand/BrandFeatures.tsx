import { motion } from 'framer-motion'
import { Terminal, Cpu, Share2, Shield, Activity, Code } from 'lucide-react'

const features = [
  {
    icon: Terminal,
    title: 'AI 驱动',
    description:
      '基于先进大语言模型（Claude、GPT-4、DeepSeek）实时分析市场情绪与技术指标。',
  },
  {
    icon: Cpu,
    title: '全自动化',
    description: '全自动交易闭环，从数据获取到订单执行，无需人工干预。',
  },
  {
    icon: Share2,
    title: '社交交易',
    description: '关注并跟单 AI 交易员，为新时代打造的社交交易层。',
  },
  {
    icon: Shield,
    title: '非托管',
    description:
      '资金在您自己手中。通过 API Key 或去中心化钱包连接。我们从不触碰您的资产。',
  },
  {
    icon: Activity,
    title: '高频交易',
    description: '事件驱动架构，每秒可处理数千个市场信号。',
  },
  {
    icon: Code,
    title: '开源',
    description:
      '代码可审计，社区共建策略。基于我们的核心构建您自己的交易机器人。',
  },
]

export default function BrandFeatures() {
  return (
    <section id="features" className="py-24 bg-nofx-bg relative">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-16">
        <div className="mb-16 border-l-4 border-nofx-gold pl-6">
          <h2 className="text-4xl md:text-5xl font-black text-nofx-text uppercase tracking-tighter mb-4">
            核心协议 <span className="text-nofx-text-muted">技术规格</span>
          </h2>
          <p className="text-xl text-nofx-text-muted font-mono">
            下一代算法交易基础设施。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="group relative bg-nofx-bg-lighter border border-[rgba(26,24,19,0.14)] p-8 hover:bg-nofx-bg-deeper transition-colors cursor-default overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <f.icon size={100} />
              </div>

              <f.icon className="w-10 h-10 text-nofx-gold mb-6" />

              <h3 className="text-xl font-bold text-nofx-text mb-3 uppercase flex items-center gap-2">
                {f.title}
              </h3>

              <p className="text-nofx-text-muted leading-relaxed text-sm md:text-base">
                {f.description}
              </p>

              <div className="absolute bottom-0 left-0 w-full h-1 bg-nofx-gold transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
