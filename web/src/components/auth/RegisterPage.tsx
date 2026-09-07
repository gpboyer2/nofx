import React, { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PasswordChecklist from 'react-password-checklist'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { t } from '../../i18n/translations'
import { getSystemConfig } from '../../lib/config'
import { DeepVoidBackground } from '../common/DeepVoidBackground'
import { RegistrationDisabled } from './RegistrationDisabled'
import { WhitelistFullPage } from '../common/WhitelistFullPage'

/** 注册页中文文案（英文文案保持原样，不做 i18n 侵入） */
const ZH = {
  abortReg: '终止注册',
  abortRegReturnHome: '终止注册并返回首页',
  betaCodeRequired: '需要内测码才能创建账户。如需内测码请联系支持。',
  createAccount: '创建账户',
  systemCheckReady: '系统检查：就绪',
  closedBetaCA1: '封闭内测 CA1',
  publicMode: '公开',
  passwordStrengthProtocol: '密码强度要求',
  priorityAccessCode: '优先访问码',
  sixDigitCode: '六位验证码',
  caseSensitiveAlphanumeric: '区分大小写字母数字（保留）',
  initializing: '初始化中...',
  encryption: '加密：AES-256',
  secureRegistry: '安全注册',
  existingOperator: '已有账户？',
  accessTerminal: '进入终端',
}

export function RegisterPage() {
  const { language } = useLanguage()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'register' | 'whitelist-full'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [betaCode, setBetaCode] = useState('')
  const [betaMode, setBetaMode] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordValid, setPasswordValid] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    getSystemConfig()
      .then((config) => {
        setBetaMode(config.beta_mode || false)
        setRegistrationEnabled(config.initialized === false)
      })
      .catch((err) => {
        console.error('Failed to fetch system config:', err)
      })
  }, [])

  if (!registrationEnabled) {
    return <RegistrationDisabled />
  }

  if (view === 'whitelist-full') {
    return <WhitelistFullPage onBack={() => setView('register')} />
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!passwordValid) {
      setError(t('passwordNotMeetRequirements', language))
      return
    }

    if (betaMode && !betaCode.trim()) {
      setError(
        language === 'zh'
          ? ZH.betaCodeRequired
          : 'A beta code is required to register during the closed beta'
      )
      return
    }

    setLoading(true)
    try {
      const result = await register(
        email,
        password,
        betaCode.trim() || undefined
      )

      const isWhitelistError = (msg: string) => {
        const lowerMsg = msg.toLowerCase()
        return (
          lowerMsg.includes('whitelist') ||
          lowerMsg.includes('capacity') ||
          lowerMsg.includes('limit') ||
          lowerMsg.includes('permission denied') ||
          lowerMsg.includes('not on whitelist')
        )
      }

      if (!result.success) {
        const msg = result.message || t('registrationFailed', language)
        if (isWhitelistError(msg)) {
          setView('whitelist-full')
          return
        }
        setError(msg)
        toast.error(msg)
      }
      // success path is handled in AuthContext (auto login + navigation)
    } catch (e) {
      console.error('Registration error:', e)
      const errorMsg =
        e instanceof Error
          ? e.message
          : language === 'zh'
            ? '注册失败，服务器错误'
            : 'Registration failed due to server error'
      const lowerMsg = errorMsg.toLowerCase()
      if (
        lowerMsg.includes('whitelist') ||
        lowerMsg.includes('capacity') ||
        lowerMsg.includes('limit') ||
        lowerMsg.includes('permission denied') ||
        lowerMsg.includes('not on whitelist')
      ) {
        setView('whitelist-full')
        return
      }
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DeepVoidBackground
      className="min-h-screen flex items-center justify-center py-12 font-mono"
      disableAnimation
    >
      <div className="w-full max-w-lg relative z-10 px-6">
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-nofx-text-muted hover:text-nofx-text transition-colors group px-3 py-1.5 rounded border border-transparent hover:border-[rgba(26,24,19,0.14)] bg-nofx-bg-deeper backdrop-blur-sm"
          >
            <div className="w-2 h-2 rounded-full bg-nofx-danger group-hover:animate-pulse"></div>
            <span className="text-xs font-mono uppercase tracking-widest">
              {language === 'zh' ? ZH.abortReg : '< ABORT_REGISTRATION'}
            </span>
          </button>
        </div>

        <div className="mb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img
                src="/icons/nofx.svg"
                alt="NoFx Logo"
                className="w-16 h-16 object-contain relative z-10 opacity-90"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-nofx-text uppercase mb-2">
            <span className="text-nofx-gold">
              {language === 'zh' ? ZH.createAccount : 'CREATE YOUR ACCOUNT'}
            </span>
          </h1>
          <p className="text-nofx-text-muted text-sm">
            {language === 'zh'
              ? '此账户拥有您的 NOFX 实例。下一步：引导式启动——约 13 美元、五分钟完成首笔 AI 交易。'
              : 'This account owns your NOFX instance. Next step: a guided launch — about $13 and five minutes to your first AI trade.'}
          </p>
        </div>

        <div className="bg-nofx-bg-lighter backdrop-blur-md border border-[rgba(26,24,19,0.14)] rounded-lg overflow-hidden shadow-lg relative group">
          <div className="flex items-center justify-between px-4 py-2 bg-nofx-bg-deeper border-b border-[rgba(26,24,19,0.14)]">
            <div className="flex gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full bg-nofx-danger/50 hover:bg-nofx-danger cursor-pointer transition-colors"
                onClick={() => navigate('/')}
                title="关闭 / 返回首页"
              ></div>
              <div className="w-2.5 h-2.5 rounded-full bg-nofx-gold/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-nofx-success/50"></div>
            </div>
            <div className="text-[10px] text-nofx-text-muted font-mono flex items-center gap-1">
              <span className="text-nofx-success">➜</span> setup_account.sh
            </div>
          </div>

          <div className="p-6 md:p-8 relative">
            <div className="mb-6 font-mono text-xs space-y-1 text-nofx-text-muted border-b border-[rgba(26,24,19,0.14)] pb-4">
              <div className="flex gap-2">
                <span className="text-nofx-success">➜</span>
                <span>
                  {language === 'zh' ? ZH.systemCheckReady : 'System Check: '}{' '}
                  <span className="text-nofx-success">
                    {language === 'zh' ? '就绪' : 'READY'}
                  </span>
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-nofx-success">➜</span>
                <span>
                  {language === 'zh' ? '模式：' : 'Mode: '}
                  {betaMode
                    ? language === 'zh'
                      ? ZH.closedBetaCA1
                      : 'CLOSED_BETA CA1'
                    : language === 'zh'
                      ? ZH.publicMode
                      : 'PUBLIC'}
                </span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wider text-nofx-text-muted mb-1.5 ml-1 font-bold">
                  {t('email', language)}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-nofx-bg border border-[rgba(26,24,19,0.14)] rounded px-4 py-3 text-sm focus:border-nofx-gold focus:ring-1 focus:ring-nofx-gold/50 outline-none transition-all placeholder-nofx-text-muted text-nofx-text font-mono"
                  placeholder="user@nofx.os"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-nofx-text-muted mb-1.5 ml-1 font-bold">
                    {t('password', language)}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-nofx-bg border border-[rgba(26,24,19,0.14)] rounded px-4 py-3 text-sm focus:border-nofx-gold focus:ring-1 focus:ring-nofx-gold/50 outline-none transition-all placeholder-nofx-text-muted text-nofx-text font-mono pr-10"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-nofx-text-muted hover:text-nofx-text transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-nofx-text-muted mb-1.5 ml-1 font-bold">
                    {t('confirmPassword', language)}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-nofx-bg border border-[rgba(26,24,19,0.14)] rounded px-4 py-3 text-sm focus:border-nofx-gold focus:ring-1 focus:ring-nofx-gold/50 outline-none transition-all placeholder-nofx-text-muted text-nofx-text font-mono pr-10"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-nofx-text-muted hover:text-nofx-text transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-nofx-bg-deeper p-3 rounded border border-[rgba(26,24,19,0.14)]">
                <div className="text-[10px] uppercase tracking-wider text-nofx-text-muted mb-2 font-bold flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-nofx-text-muted"></div>
                  {language === 'zh'
                    ? ZH.passwordStrengthProtocol
                    : 'Password Strength Protocol'}
                </div>
                <div className="text-xs font-mono text-nofx-text-muted">
                  <PasswordChecklist
                    rules={[
                      'minLength',
                      'capital',
                      'lowercase',
                      'number',
                      'specialChar',
                      'match',
                    ]}
                    minLength={8}
                    value={password}
                    valueAgain={confirmPassword}
                    messages={{
                      minLength: t('passwordRuleMinLength', language),
                      capital: t('passwordRuleUppercase', language),
                      lowercase: t('passwordRuleLowercase', language),
                      number: t('passwordRuleNumber', language),
                      specialChar: t('passwordRuleSpecial', language),
                      match: t('passwordRuleMatch', language),
                    }}
                    className="grid grid-cols-2 gap-x-4 gap-y-1"
                    onChange={(isValid) => setPasswordValid(isValid)}
                    iconSize={10}
                  />
                </div>
              </div>

              {betaMode && (
                <div>
                  <label className="block text-xs uppercase tracking-wider text-nofx-gold mb-1.5 ml-1 font-bold">
                    {language === 'zh'
                      ? ZH.priorityAccessCode
                      : 'Priority Access Code'}
                  </label>
                  <input
                    type="text"
                    value={betaCode}
                    onChange={(e) =>
                      setBetaCode(
                        e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase()
                      )
                    }
                    className="w-full bg-nofx-bg border border-[rgba(26,24,19,0.14)] rounded px-4 py-3 text-sm focus:border-nofx-gold focus:ring-1 focus:ring-nofx-gold/50 outline-none transition-all placeholder-nofx-text-muted text-nofx-text font-mono tracking-widest"
                    placeholder={language === 'zh' ? ZH.sixDigitCode : 'XXXXXX'}
                    maxLength={6}
                    required={betaMode}
                  />
                  <p className="text-[10px] text-nofx-text-muted font-mono mt-1 ml-1">
                    *{' '}
                    {language === 'zh'
                      ? ZH.caseSensitiveAlphanumeric
                      : 'CASE SENSITIVE ALPHANUMERIC'}
                  </p>
                </div>
              )}

              {error && (
                <div className="text-xs bg-nofx-danger/10 border border-nofx-danger/30 text-nofx-danger px-3 py-2 rounded font-mono">
                  [REGISTRATION_ERROR]: {error}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading || (betaMode && !betaCode.trim()) || !passwordValid
                }
                className="w-full bg-nofx-gold text-nofx-bg font-bold py-3 px-4 rounded text-sm tracking-wide uppercase hover:bg-nofx-gold-highlight transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-mono flex items-center justify-center gap-2 group mt-4"
              >
                {loading ? (
                  <span className="animate-pulse">
                    {language === 'zh' ? ZH.initializing : 'INITIALIZING...'}
                  </span>
                ) : (
                  <>
                    <span>
                      {language === 'zh' ? ZH.createAccount : 'CREATE_ACCOUNT'}
                    </span>
                    <span className="group-hover:translate-x-1 transition-transform">
                      -&gt;
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-nofx-bg-deeper p-3 flex justify-between items-center text-[10px] font-mono text-nofx-text-muted border-t border-[rgba(26,24,19,0.14)]">
            <div>
              {language === 'zh' ? ZH.encryption : 'ENCRYPTION: AES-256'}
            </div>
            <div>
              {language === 'zh' ? ZH.secureRegistry : 'SECURE_REGISTRY'}
            </div>
          </div>
        </div>

        <div className="text-center mt-8 space-y-4">
          <p className="text-xs font-mono text-nofx-text-muted">
            {language === 'zh' ? ZH.existingOperator : 'EXISTING_OPERATOR? '}
            <button
              onClick={() => navigate('/login')}
              className="text-nofx-gold hover:underline hover:text-nofx-gold-highlight transition-colors ml-1 uppercase"
            >
              {language === 'zh' ? ZH.accessTerminal : 'ACCESS TERMINAL'}
            </button>
          </p>
          <button
            onClick={() => navigate('/')}
            className="text-[10px] text-nofx-text-muted hover:text-nofx-danger transition-colors uppercase tracking-widest hover:underline decoration-nofx-danger/30 font-mono"
          >
            [{' '}
            {language === 'zh'
              ? ZH.abortRegReturnHome
              : 'ABORT_REGISTRATION_RETURN_HOME'}{' '}
            ]
          </button>
        </div>
      </div>
    </DeepVoidBackground>
  )
}
