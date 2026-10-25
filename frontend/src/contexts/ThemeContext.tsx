import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Reset sekali dari preferensi tema lama agar update fitur dimulai dalam mode terang.
const THEME_STORAGE_KEY = 'theme-preference-v5'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function getInitialTheme(): Theme {
  // Tampilan pertama selalu terang. User dapat mengaktifkan mode gelap dari navbar.
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.removeItem('theme')
      localStorage.removeItem('theme-preference')
      localStorage.removeItem('theme-preference-v3')
      localStorage.removeItem('theme-preference-v4')
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Continue without persistence if browser storage is unavailable.
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
