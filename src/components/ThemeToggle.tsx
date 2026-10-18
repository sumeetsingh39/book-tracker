import { useTheme, type ThemePref } from '../hooks/useTheme'

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { pref, setPref } = useTheme()

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          className={`theme-option ${pref === o.value ? 'theme-option-active' : ''}`}
          onClick={() => setPref(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
