// Runs before the first paint: put the resolved theme on <html> so the page
// never flashes the wrong colours. Same rule as applyTheme() in src/lib/theme.ts.
;(function () {
  try {
    var mode = localStorage.getItem('ww.theme')
    var dark = mode === 'dark' || (mode !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch (e) {
    /* private mode: CSS falls back to light, the app fixes it on start */
  }
})()
