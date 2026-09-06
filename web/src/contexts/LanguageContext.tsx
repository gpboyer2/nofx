import { createContext, useContext, useState, ReactNode } from 'react'
import type { Language } from '../i18n/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
)

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('language')
  if (stored === 'en' || stored === 'zh' || stored === 'id') {
    return stored
  }
  localStorage.setItem('language', 'zh')
  return 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage)

  const handleSetLanguage = (lang: Language) => {
    localStorage.setItem('language', lang)
    setLanguage(lang)
  }

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleSetLanguage }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
