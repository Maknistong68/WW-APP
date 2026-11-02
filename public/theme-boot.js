// Runs before the first paint: put the resolved theme on <html> so the page
// never flashes the wrong colours. Same rule as applyTheme() in src/lib/theme.ts.
;(function () {
  try {
    var mode = localStorage.getItem('ww.theme')
    var dark = mode === 'dark' || (mode !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    // the phone's status bar matches from the first frame (same colours as THEME_COLOR in theme.ts)
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#F3F4F6')
  } catch (e) {
    /* private mode: CSS falls back to light, the app fixes it on start */
  }
})()
