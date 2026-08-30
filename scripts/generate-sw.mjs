import { generateSW } from 'workbox-build'

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  swDest: 'dist/sw.js',
  globPatterns: [
    'index.html',
    '404.html',
    'manifest.webmanifest',
    '_astro/*.{js,css,woff,woff2}',
    'favicon/*.png',
  ],
  cleanupOutdatedCaches: true,
  clientsClaim: false,
  skipWaiting: false,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'minjer-pages',
        networkTimeoutSeconds: 3,
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
        url.origin === self.location.origin && url.pathname.includes('/pagefind/'),
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
