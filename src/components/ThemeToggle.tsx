import { CircleHalf, Moon, Sun } from '@phosphor-icons/react'
import type { ThemePref } from '../hooks/useTheme'

// eslint-disable-next-line react-refresh/only-export-components
export const THEME_OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Auto', Icon: CircleHalf },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

// One icon button that steps through Auto → Light → Dark (shown signed out;
// signed in, the account menu offers the same choices).
export function ThemeToggle({ pref, setPref }: { pref: ThemePref; setPref: (p: ThemePref) => void }) {
  const i = THEME_OPTIONS.findIndex((o) => o.value === pref)
  const current = THEME_OPTIONS[i]
  const next = THEME_OPTIONS[(i + 1) % THEME_OPTIONS.length]

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
      title={`Theme: ${current.label}`}
      onClick={() => setPref(next.value)}
    >
      <current.Icon aria-hidden />
    </button>
  )
}
