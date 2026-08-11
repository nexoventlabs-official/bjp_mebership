import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { translations } from './translations.js'

const LANG_KEY = 'bjp_lang'

function interpolate(str, params) {
  if (!params) return str
  return String(str).replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m))
}

function readInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'en' || saved === 'ta') return saved
  } catch { /* ignore */ }
  return 'en'
}

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (s) => s,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readInitialLang)

  const setLang = useCallback((next) => {
    if (next !== 'en' && next !== 'ta') return
    setLangState(next)
    try { localStorage.setItem(LANG_KEY, next) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { document.documentElement.setAttribute('lang', lang) } catch { /* ignore */ }
  }, [lang])

  // t(english, params?) -> translated + interpolated string.
  const t = useCallback((en, params) => {
    const dict = lang === 'ta' ? translations.ta : null
    const translated = dict && dict[en] !== undefined ? dict[en] : en
    return interpolate(translated, params)
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}
