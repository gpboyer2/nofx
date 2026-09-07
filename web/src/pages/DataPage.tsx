import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import {
  dataApi,
  type FlowMarketItem,
  type SignalRankItem,
} from '../lib/api/data'
import { useLanguage } from '../contexts/LanguageContext'

const text = (language: string, zh: string, en: string) =>
  language === 'zh' ? zh : en

/**
 * 数据中心页 — 依赖 NOFX 自己的付费数据接口（claw402/vergex），不再内嵌
 * vergex.trade：对方设置了 X-Frame-Options: sameorigin，iframe 必然白屏。
 * 页面展示两个数据源：多空方向榜 + 资金净流排行；接口失败时给出人话提示
 * （钱包缺 Base ETH/USDC 被上游限流是当前已知主因）和 vergex 官网外链。
 */
export function DataPage() {
  const { language } = useLanguage()
  const [signals, setSignals] = useState<SignalRankItem[]>([])
  const [inflow, setInflow] = useState<FlowMarketItem[]>([])
  const [outflow, setOutflow] = useState<FlowMarketItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [board, flow] = await Promise.all([
        dataApi.getDirectionChangeLeaderboard(25),
        dataApi.getFlowMarkets(undefined, 'mainnet', '1h', 25),
      ])
      setSignals(board.items || [])
      setInflow(flow.data?.inflow || [])
      setOutflow(flow.data?.outflow || [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : text(language, '数据服务不可用', 'Data service unavailable')
      )
      setSignals([])
      setInflow([])
      setOutflow([])
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    void load()
  }, [load])

  const th: CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(26,24,19,0.14)',
    fontSize: 12,
    color: 'rgba(26,24,19,0.6)',
    whiteSpace: 'nowrap',
  }
  const td: CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid rgba(26,24,19,0.08)',
    fontSize: 13,
    whiteSpace: 'nowrap',
  }
  const panel: CSSProperties = {
    border: '1px solid rgba(26,24,19,0.14)',
    borderRadius: 12,
    background: '#faf9f5',
    padding: 16,
    overflowX: 'auto',
  }

  const biasLabel = (bias: string) => {
    if (bias === 'bullish') return text(language, '看多', 'Bullish')
    if (bias === 'bearish') return text(language, '看空', 'Bearish')
    return text(language, '中性', 'Neutral')
  }
  const biasColor = (bias: string) =>
    bias === 'bullish'
      ? '#A32D2D'
      : bias === 'bearish'
        ? '#3B6D11'
        : 'rgba(26,24,19,0.6)'

  const fmtNum = (raw: string | number) => {
    const n = typeof raw === 'number' ? raw : parseFloat(raw)
    if (!isFinite(n)) return '-'
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
    return `${sign}$${abs.toFixed(2)}`
  }

  const flowTable = (title: string, rows: FlowMarketItem[]) => (
    <div style={panel}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>#</th>
            <th style={th}>{text(language, '标的', 'Symbol')}</th>
            <th style={th}>{text(language, '净流', 'Net flow')}</th>
            <th style={th}>{text(language, '买量', 'Buy')}</th>
            <th style={th}>{text(language, '卖量', 'Sell')}</th>
            <th style={th}>{text(language, '最新价', 'Last')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.key || `${row.symbol}-${i}`}>
              <td style={{ ...td, color: 'rgba(26,24,19,0.5)' }}>{i + 1}</td>
              <td style={{ ...td, fontFamily: 'monospace', fontWeight: 500 }}>
                {row.symbol}
              </td>
              <td
                style={{
                  ...td,
                  color: row.netFlow?.startsWith('-') ? '#3B6D11' : '#A32D2D',
                }}
              >
                {fmtNum(row.netFlow)}
              </td>
              <td style={{ ...td, color: 'rgba(26,24,19,0.7)' }}>
                {fmtNum(row.buyNotional)}
              </td>
              <td style={{ ...td, color: 'rgba(26,24,19,0.7)' }}>
                {fmtNum(row.sellNotional)}
              </td>
              <td style={{ ...td, color: 'rgba(26,24,19,0.7)' }}>
                {fmtNum(row.latestPrice)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={td} colSpan={6}>
                {text(language, '暂无数据', 'No data')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {text(language, '数据中心', 'Data Center')}
          </div>
          <div
            style={{ fontSize: 12, color: 'rgba(26,24,19,0.55)', marginTop: 4 }}
          >
            {text(
              language,
              '多空方向榜 · 资金净流排行（数据来自 Vergex / claw402，按次计费）',
              'Direction board · net-flow ranking (Vergex / claw402, pay-per-call)'
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="https://vergex.trade/trending"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(26,24,19,0.24)',
              fontSize: 13,
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            {text(language, '打开 Vergex 官网', 'Open Vergex')}
          </a>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(26,24,19,0.24)',
              background: 'rgba(26,24,19,0.04)',
              fontSize: 13,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading
              ? text(language, '加载中…', 'Loading…')
              : text(language, '刷新', 'Refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid rgba(163,45,45,0.35)',
            background: 'rgba(252,235,235,0.7)',
            color: '#791F1F',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {error}
          <a
            href="https://vergex.trade/trending"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#A32D2D', marginLeft: 8 }}
          >
            vergex.trade/trending →
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panel}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            {text(language, '多空方向榜', 'Direction Board')}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>{text(language, '标的', 'Symbol')}</th>
                <th style={th}>{text(language, '方向', 'Bias')}</th>
                <th style={th}>{text(language, '方向分', 'Score')}</th>
                <th style={th}>{text(language, '市场', 'Market')}</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((item) => (
                <tr key={`${item.rank}-${item.symbol}`}>
                  <td style={{ ...td, color: 'rgba(26,24,19,0.5)' }}>
                    {item.rank}
                  </td>
                  <td
                    style={{ ...td, fontFamily: 'monospace', fontWeight: 500 }}
                  >
                    {item.symbol}
                  </td>
                  <td
                    style={{
                      ...td,
                      color: biasColor(item.bias),
                      fontWeight: 500,
                    }}
                  >
                    {biasLabel(item.bias)}
                  </td>
                  <td style={{ ...td, color: 'rgba(26,24,19,0.7)' }}>
                    {item.score ?? '-'}
                  </td>
                  <td style={{ ...td, color: 'rgba(26,24,19,0.7)' }}>
                    {item.market_type || '-'}
                  </td>
                </tr>
              ))}
              {signals.length === 0 && !error && (
                <tr>
                  <td style={td} colSpan={5}>
                    {loading
                      ? text(language, '加载中…', 'Loading…')
                      : text(language, '暂无数据', 'No data')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 16,
          }}
        >
          {flowTable(
            text(language, '资金净流入排行（1h）', 'Net Inflow (1h)'),
            inflow
          )}
          {flowTable(
            text(language, '资金净流出排行（1h）', 'Net Outflow (1h)'),
            outflow
          )}
        </div>
      </div>
    </div>
  )
}
