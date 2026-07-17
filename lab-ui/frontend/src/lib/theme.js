// Light/dark theme. The app is dark-first (default 'dark'); light mode is applied
// by setting data-theme="light" on <html>, which index.css overrides against.
const KEY = 'oneflare_theme'

export function getTheme() {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'dark'
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
}

export function setTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark'
  localStorage.setItem(KEY, t)
  applyTheme(t)
  return t
}
