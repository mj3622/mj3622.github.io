import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  swDest: 'dist/sw.js',
  globPatterns: [
    '404.html',
    'manifest.webmanifest',
    '_astro/*.{js,css,woff,woff2}',
    'favicon/*.png',
  ],
  cleanupOutdatedCaches: true,
  // Let open pages finish using their assets before activating a new worker.
  clientsClaim: false,
  skipWaiting: false,
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        url.origin === self.location.origin &&
        (request.mode === 'navigate' ||
          // Astro's client router fetches HTML without a navigation request.
          (request.destination === '' &&
            (/\/$/.test(url.pathname) ||
              !url.pathname.split('/').pop().includes('.') ||
              url.pathname.endsWith('.html')))),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'minjer-pages',
        networkTimeoutSeconds: 3,
        plugins: [
          {
            // Workbox ignores fetchOptions for navigation requests.
            requestWillFetch: async ({ request }) =>
              new Request(request, { cache: 'no-cache' }),
          },
        ],
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
        precacheFallback: {
          fallbackURL: '/404.html',
        },
      },
    },
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        url.pathname.includes('/pagefind/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'minjer-search',
        expiration: {
          maxEntries: 160,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ request, url }) =>
        url.origin === self.location.origin && request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'minjer-images',
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
})

for (const warning of warnings) console.warn(`[workbox] ${warning}`)
console.log(`[workbox] precached ${count} files (${size} bytes)`)
