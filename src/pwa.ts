function notify(state: NonNullable<Window['pwaState']>) {
  window.pwaState = state
  document.dispatchEvent(new CustomEvent(`pwa:${state}`))
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  await navigator.serviceWorker.register('/sw.js', {
    updateViaCache: 'none',
  })

  await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller) notify('offline-ready')
}

window.addEventListener('load', () => {
  void registerServiceWorker().catch(() => {
    // PWA support is optional; a registration policy failure must not break the site.
  })
})
