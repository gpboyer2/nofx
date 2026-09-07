import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Copy, RefreshCw, Shield, Wallet, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { useLanguage } from '../contexts/LanguageContext'
import { api } from '../lib/api'
import type { BeginnerOnboardingResponse } from '../types'
import {
  setBeginnerWalletAddress,
  markBeginnerOnboardingCompleted,
} from '../lib/onboarding'

export function BeginnerOnboardingPage() {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const [data, setData] = useState<BeginnerOnboardingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshingBalance, setRefreshingBalance] = useState(false)
  const hasRequestedRef = useRef(false)
  const isZh = language === 'zh'

  const loadOnboarding = async (showLoading: boolean) => {
    if (showLoading) {
      setLoading(true)
    } else {
      setRefreshingBalance(true)
    }

    setError('')
    try {
      const result = await api.prepareBeginnerOnboarding()
      setData(result)
      setBeginnerWalletAddress(result.address)
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法创建新手钱包')
    } finally {
      if (showLoading) {
        setLoading(false)
      } else {
        setRefreshingBalance(false)
      }
    }
  }

  useEffect(() => {
    if (hasRequestedRef.current) {
      return
    }
    hasRequestedRef.current = true
    void loadOnboarding(true)
  }, [])

  // Poll the balance while the user is depositing so the page updates on its
  // own. Uses the lightweight current-wallet endpoint (server caches 30s), not
  // the heavier prepare call that re-writes .env.
  const walletAddress = data?.address
  useEffect(() => {
    if (!walletAddress) return
    let cancelled = false
    const timer = setInterval(() => {
      void api
        .getCurrentBeginnerWallet()
        .then((wallet) => {
          if (cancelled || !wallet.found || !wallet.balance_usdc) return
          setData((prev) =>
            prev && prev.address === wallet.address
              ? { ...prev, balance_usdc: wallet.balance_usdc! }
              : prev
          )
        })
        .catch(() => {
          // transient — the manual refresh button still works
        })
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [walletAddress])

  const noticeText = useMemo(
    () =>
      '本钱包仅用于支付模型调用费用，不会自动为您的交易所充值。私钥无法恢复，且您只能充值 Base USDC。',
    [isZh]
  )

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} 已复制`)
    } catch {
      toast.error('复制失败')
    }
  }

  const handleContinue = () => {
    markBeginnerOnboardingCompleted()
    navigate('/traders')
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/58 backdrop-blur-[2px]" />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <button
          type="button"
          onClick={handleContinue}
          className="absolute right-6 top-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(26,24,19,0.14)] bg-nofx-text/5 text-nofx-text-muted transition hover:border-[rgba(26,24,19,0.24)] hover:bg-nofx-text/10 hover:text-nofx-text"
          aria-label="跳过"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="w-full max-w-[1120px]">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-nofx-gold/20 bg-nofx-gold/8 text-nofx-gold">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div
                  className={`font-semibold uppercase text-nofx-gold/80 ${
                    isZh
                      ? 'text-[11px] tracking-[0.34em]'
                      : 'text-[10px] tracking-[0.2em]'
                  }`}
                >
                  {'新手守护'}
                </div>
                <h1
                  className={`mt-2 font-bold leading-[1.04] text-nofx-text ${
                    isZh
                      ? 'text-[34px] tracking-tight sm:text-[44px] xl:text-[52px] xl:whitespace-nowrap'
                      : 'max-w-[720px] text-[27px] tracking-[-0.03em] sm:text-[35px] xl:text-[42px]'
                  }`}
                >
                  {'您的钱包已准备就绪'}
                </h1>
              </div>
            </div>

            <div
              className={`pb-2 text-nofx-text-muted lg:text-right ${
                isZh
                  ? 'text-sm tracking-[0.18em] lg:whitespace-nowrap'
                  : 'text-[13px] tracking-[0.12em] lg:whitespace-nowrap'
              }`}
            >
              Claw402 + DeepSeek{' '}
              <span className="mx-2 text-nofx-text-muted">·</span>
              {'按次付费'}
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-[rgba(26,24,19,0.14)] bg-nofx-bg-lighter shadow-lg backdrop-blur-2xl">
            {loading ? (
              <div className="flex min-h-[390px] items-center justify-center px-6 text-sm text-nofx-text-muted">
                {'正在准备您的 Base 钱包...'}
              </div>
            ) : data ? (
              <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
                <section className="flex flex-col justify-center px-8 py-7 sm:px-9 lg:min-h-[430px]">
                  <div className="mx-auto w-full max-w-[248px] text-center">
                    <div className="mx-auto inline-flex rounded-[28px] border border-[rgba(26,24,19,0.14)] bg-white p-4 shadow-sm">
                      <QRCodeSVG value={data.address} size={164} level="M" />
                    </div>

                    <div className="mt-4 text-[15px] font-medium text-nofx-text">
                      {'充值地址 (Base USDC)'}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[24px] border border-nofx-success/20 bg-nofx-success/10 px-5 py-3.5">
                      <div className="text-left">
                        <div className="flex items-baseline gap-3 font-mono font-bold tracking-tight text-nofx-success">
                          <span className="text-[22px]">
                            {data.balance_usdc}
                          </span>
                          <span className="text-[20px]">USDC</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadOnboarding(false)}
                        disabled={refreshingBalance}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-nofx-success/20 bg-nofx-bg-deeper text-nofx-success transition hover:bg-nofx-success/10 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="刷新余额"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshingBalance ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="mt-4 text-sm text-nofx-text-muted">
                      5–10 美元通常可用很长时间 · 充值后余额会自动更新
                    </div>

                    {/* the wall every true beginner hits: where does USDC come from? */}
                    <div className="mt-5 rounded-2xl border border-nofx-gold/20 bg-nofx-gold/10 px-5 py-4 text-left text-[13px] leading-6 text-nofx-text">
                      <div className="mb-1 font-semibold">还没有 USDC？</div>在
                      Binance、OKX 或 Coinbase 购买 USDC，然后提款到上面的地址 —
                      交易所询问时选择 <b>Base network</b>
                      。通常约一分钟到账。请只发送 Base 链上的 USDC。
                    </div>
                  </div>
                </section>

                <section className="border-t border-[rgba(26,24,19,0.14)] px-8 py-7 lg:border-l lg:border-t-0 lg:px-9">
                  <div className="space-y-5">
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-nofx-gold">
                        <Wallet className="h-4 w-4" />
                        <span>钱包地址</span>
                      </div>
                      <div className="flex items-stretch gap-3">
                        <div className="min-w-0 flex-1 rounded-2xl border border-[rgba(26,24,19,0.14)] bg-nofx-bg-deeper px-5 py-3 font-mono text-[14px] text-nofx-text">
                          <div className="break-all">{data.address}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(data.address, '地址')}
                          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[rgba(26,24,19,0.14)] bg-nofx-text/5 text-nofx-text transition hover:border-[rgba(26,24,19,0.24)] hover:bg-nofx-text/10 hover:text-nofx-text"
                          aria-label="复制地址"
                        >
                          <Copy className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-1">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-nofx-gold">
                        <Shield className="h-4 w-4" />
                        <span>{'私钥，请立即备份'}</span>
                      </div>
                      <div className="flex items-stretch gap-3">
                        <div className="min-w-0 flex-1 rounded-[24px] border border-nofx-gold/20 bg-nofx-gold/10 px-5 py-3 font-mono text-[13px] leading-6 text-nofx-text">
                          <div className="overflow-x-auto whitespace-nowrap">
                            {data.private_key}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col justify-end">
                          <button
                            type="button"
                            onClick={() => copyText(data.private_key, '私钥')}
                            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-nofx-gold/20 bg-nofx-gold/10 text-nofx-gold transition hover:bg-nofx-gold/15"
                            aria-label="复制私钥"
                          >
                            <Copy className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-[24px] border border-[rgba(26,24,19,0.14)] bg-nofx-bg-deeper px-5 py-3.5 text-nofx-text-muted ${
                        isZh
                          ? 'text-xs lg:whitespace-nowrap'
                          : 'text-[11px] leading-6'
                      }`}
                    >
                      <span className="mr-2 text-nofx-text-muted">•</span>
                      {noticeText}
                    </div>

                    {data.env_warning ? (
                      <div className="rounded-2xl border border-nofx-gold/20 bg-nofx-gold/10 px-4 py-3 text-sm text-nofx-gold">
                        {data.env_warning}
                      </div>
                    ) : null}

                    {error ? (
                      <div className="rounded-2xl border border-nofx-danger/20 bg-nofx-danger/10 px-4 py-3 text-sm text-nofx-danger">
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleContinue}
                      className={`mt-1 flex w-full items-center justify-center gap-3 rounded-[24px] bg-nofx-gold px-5 py-3.5 font-bold text-nofx-bg transition hover:bg-nofx-gold-highlight ${
                        isZh ? 'text-[20px]' : 'text-[16px] sm:text-[18px]'
                      }`}
                    >
                      <span>继续设置</span>
                      <ArrowRight className="h-5 w-5" />
                    </button>

                    {data.env_saved ? (
                      <div className="pt-1 text-xs text-nofx-text-muted">
                        {`钱包详情也已保存到 ${data.env_path || '.env'}`}
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
