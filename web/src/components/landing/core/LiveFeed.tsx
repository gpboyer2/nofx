import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface LogEntry {
  id: number
  time: string
  type: string
  msg: string
  color: string
}

const generateLog = (id: number): LogEntry => {
  const types = ['执行', '信号', '风险', '宏观', '系统']
  const pairs = [
    'AAPL-USDC',
    'NVDA-USDC',
    'GOLD-USDC',
    'EURUSD-USDC',
    'OPENAI-IPO',
  ]
  const actions = ['买入', '卖出', '对冲', '调仓']
  const type = types[Math.floor(Math.random() * types.length)]

  let msg = ''
  let color = ''

  switch (type) {
    case 'EXEC':
      msg = `智能体-${Math.floor(Math.random() * 99)} ${actions[Math.floor(Math.random() * 4)]} ${pairs[Math.floor(Math.random() * pairs.length)]} @ ${Math.floor(Math.random() * 600)}`
      color = 'text-nofx-success'
      break
    case 'SIGNAL':
      msg = `美股动量信号确认（z 分值：${Math.random().toFixed(3)}）`
      color = 'text-nofx-gold'
      break
    case 'RISK':
      msg = `风险检查通过：${pairs[Math.floor(Math.random() * pairs.length)]} 敞口在限额内`
      color = 'text-nofx-danger'
      break
    case 'MACRO':
      msg = `宏观数据流延迟 < ${Math.floor(Math.random() * 10)}ms`
      color = 'text-nofx-text-muted'
      break
    default:
      msg = `系统优化周期完成。正在分配资源。`
      color = 'text-nofx-accent'
  }

  return {
    id,
    time:
      new Date().toLocaleTimeString('en-US', { hour12: false }) +
      '.' +
      Math.floor(Math.random() * 999),
    type,
    msg,
    color,
  }
}

export default function LiveFeed() {
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    // Initial population
    const initialLogs = Array.from({ length: 8 }).map((_, i) => generateLog(i))
    setLogs(initialLogs)

    const interval = setInterval(() => {
      setLogs((prev) => {
        const newLog = generateLog(Date.now())
        return [newLog, ...prev.slice(0, 7)]
      })
    }, 800) // Fast 800ms updates for HFT feel

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="w-full bg-nofx-bg-lighter border-y border-[rgba(26,24,19,0.14)] py-1 overflow-hidden relative">
      <div className="max-w-[1920px] mx-auto px-4 flex flex-col md:flex-row gap-0 md:gap-8 items-stretch h-[240px] md:h-12 text-xs font-mono">
        {/* Left Status Bar (Static) */}
        <div className="hidden md:flex items-center gap-6 text-nofx-text-muted border-r border-[rgba(26,24,19,0.14)] pr-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-nofx-success rounded-full animate-pulse"></div>
            <span className="font-bold text-nofx-text">WS连接: 稳定</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-nofx-gold">TPS: 48,291</span>
          </div>
        </div>

        {/* Right Scrolling Log - Vertical on mobile, Single line ticker on Desktop */}
        <div className="flex-1 overflow-hidden relative font-mono text-[10px] md:text-sm h-full flex items-center">
          {/* Desktop View: Single Line Fade */}
          <div className="hidden md:block w-full h-full relative">
            {logs.slice(0, 1).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute inset-0 flex items-center gap-4"
              >
                <span className="text-nofx-text-muted">[{log.time}]</span>
                <span
                  className={`font-bold w-10 ${
                    log.type === 'RISK'
                      ? 'text-nofx-danger bg-nofx-danger/10 px-1 rounded'
                      : log.type === 'SIGNAL'
                        ? 'text-nofx-gold bg-nofx-gold/10 px-1 rounded'
                        : log.type === 'EXEC'
                          ? 'text-nofx-success'
                          : 'text-nofx-text-muted'
                  }`}
                >
                  {log.type}
                </span>
                <span className={`${log.color}`}>{log.msg}</span>
              </motion.div>
            ))}
          </div>

          {/* Mobile View: Vertical Stack */}
          <div className="md:hidden flex flex-col gap-2 w-full p-4 h-full overflow-hidden">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-2 w-full truncate border-b border-[rgba(26,24,19,0.10)] pb-1 last:border-0"
              >
                <span className="text-nofx-text-muted w-16 shrink-0">
                  {log.time.split('.')[0]}
                </span>
                <span
                  className={`font-bold w-8 shrink-0 ${
                    log.type === 'RISK'
                      ? 'text-nofx-danger'
                      : log.type === 'SIGNAL'
                        ? 'text-nofx-gold'
                        : 'text-nofx-text-muted'
                  }`}
                >
                  {log.type}
                </span>
                <span className={`${log.color} truncate`}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
