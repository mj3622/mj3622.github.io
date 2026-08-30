function notify(state: NonNullable<Window['pwaState']>) {
  window.pwaState = state
  document.dispatchEvent(new CustomEvent(`pwa:${state}`))
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  let refreshing = false
  const registration = await navigator.serviceWorker.register('/sw.js')

  window.updateServiceWorker = async () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }

  if (registration.waiting) notify('need-refresh')

  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return
      notify(
        navigator.serviceWorker.controller ? 'need-refresh' : 'offline-ready',
      )
    })
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })

  await navigator.serviceWorker.ready
  if (!navigator.serviceWorker.controller) notify('offline-ready')
}

window.addEventListener('load', () => {
  void registerServiceWorker().catch(() => {
    // PWA support is optional; a registration policy failure must not break the site.
  })
})
