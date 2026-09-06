import type { UserMode } from '../../lib/onboarding'

interface OnboardingModeSelectorProps {
  mode: UserMode
  onChange: (mode: UserMode) => void
}

export function OnboardingModeSelector({
  mode,
  onChange,
}: OnboardingModeSelectorProps) {
  const options: Array<{
    id: UserMode
    title: string
    badge?: string
    description: string
  }> = [
    {
      id: 'beginner',
      title: '初学者模式',
      badge: '推荐',
      description: '自动生成 Base 钱包，默认使用 Claw402 + GLM。',
    },
    {
      id: 'advanced',
      title: '高级模式',
      description: '保留完整的手动配置流程，自行设置模型、钱包和交易所。',
    },
  ]

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-nofx-text-muted">
        使用体验
      </div>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => {
          const selected = option.id === mode
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                  ? 'border-nofx-gold/60 bg-nofx-gold/10'
                  : 'border-[rgba(26,24,19,0.14)] bg-nofx-bg-lighter hover:border-nofx-gold/40'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-nofx-text">
                <span>{option.title}</span>
                {option.badge ? (
                  <span className="rounded-full bg-nofx-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-nofx-bg">
                    {option.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-nofx-text-muted">
                {option.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
