import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LanguageProvider, useLanguage } from './LanguageContext'
import { Header } from '../components/common/Header'

function LanguageProbe() {
  const { language } = useLanguage()
  return <div>{language}</div>
}

describe('Bilingual language support', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to Chinese when no language is stored', async () => {
    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(screen.getByText('zh')).toBeTruthy()
    await waitFor(() => expect(localStorage.getItem('language')).toBe('zh'))
  })

  it('respects stored language preference', async () => {
    localStorage.setItem('language', 'en')

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(screen.getByText('en')).toBeTruthy()
  })

  it('does not render a language switcher in the header', () => {
    render(
      <LanguageProvider>
        <Header simple />
      </LanguageProvider>
    )

    expect(screen.queryByRole('button', { name: '中文' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'EN' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'ID' })).toBeNull()
  })
})
