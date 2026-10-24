import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { transpileModule } from 'typescript'
import { generateSW } from 'workbox-build'

// Use the production worker generator on a tiny site to exercise real updates.
async function createSite(legacy = false) {
  const root = await mkdtemp(join(tmpdir(), 'blog-pwa-'))
  const dist = join(root, 'dist')
  await mkdir(join(dist, '_astro'), { recursive: true })
  await writeFile(join(dist, '404.html'), '<h1>Offline</h1>')
  const source = await readFile(resolve('src/pwa.ts'), 'utf8')
  const app = transpileModule(
    source.replace('import.meta.env.DEV', 'false'),
    {},
  ).outputText
  const legacyApp = `
    navigator.serviceWorker.register('/sw.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  `

  async function publish(version: number, oldPolicy = false) {
    await writeFile(
      join(dist, `_astro/app-${version}.js`),
      oldPolicy ? legacyApp : app,
    )
    await writeFile(
      join(dist, 'index.html'),
      `<!doctype html><title>Version ${version}</title>
      <h1>Version ${version}</h1><input aria-label="Note">
      <div style="height:3000px"></div>
      <script src="/_astro/app-${version}.js"></script>`,
    )
    if (oldPolicy) {
      await generateSW({
        globDirectory: dist,
        swDest: join(dist, 'sw.js'),
        globPatterns: ['index.html', '404.html', '_astro/*.js'],
        skipWaiting: false,
        clientsClaim: false,
      })
    } else {
      execFileSync(process.execPath, [resolve('scripts/generate-sw.mjs')], {
        cwd: root,
        stdio: 'pipe',
      })
    }
  }

  await publish(1, legacy)
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname
    try {
      const data = await readFile(
        join(dist, path === '/' ? 'index.html' : path),
      )
      response.writeHead(200, {
        'Content-Type': path.endsWith('.js') ? 'text/javascript' : 'text/html',
        'Cache-Control': path.endsWith('.js') ? 'no-cache' : 'max-age=3600',
      })
      response.end(data)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No server port')
  return {
    url: `http://127.0.0.1:${address.port}/`,
    publish,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve())),
      )
      await rm(root, { recursive: true, force: true })
    },
  }
}

test('首页优先读取网络，断网时回退到最近访问的内容', async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const site = await createSite()
  try {
    await page.goto(site.url)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await site.publish(2)
    await page.goto(site.url)
    await expect(page.locator('h1')).toHaveText('Version 2')
    await site.publish(3)
    const html = await page.evaluate(async () => {
      const response = await fetch(location.href)
      return response.text()
    })
    expect(html).toContain('Version 3')
    await expect(page.locator('h1')).toHaveText('Version 2')
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const cache = await caches.open('minjer-pages')
          const response = await cache.match(location.href)
          return response?.text()
        }),
      )
      .toContain('Version 3')
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toHaveText('Version 3')
  } finally {
    await context.setOffline(false)
    await page.close()
    await site.close()
  }
})

for (const legacy of [false, true]) {
  test(`${legacy ? '旧版迁移' : '后续更新'}保持阅读状态，关闭旧页面后自动切换缓存`, async ({
    page,
    context,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop')
    const site = await createSite(legacy)
    try {
      await page.goto(site.url)
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.reload()
      await page.getByRole('textbox').fill('Keep my reading state')
      await page.evaluate(() => window.scrollTo(0, 500))
      await site.publish(2)
      const installed = context.waitForEvent('serviceworker')
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready
        await registration.update()
      })
      const worker = await installed
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready
            return registration.waiting?.state
          }),
        )
        .toBe('installed')
      await expect(page.locator('h1')).toHaveText('Version 1')
      await expect(page.getByRole('textbox')).toHaveValue(
        'Keep my reading state',
      )
      expect(await page.evaluate(() => window.scrollY)).toBe(500)
      await page.close()
      await expect
        .poll(() =>
          worker.evaluate(
            () =>
              !self.registration.waiting &&
              self.registration.active?.state === 'activated',
          ),
        )
        .toBe(true)
      const next = await context.newPage()
      await next.goto(site.url)
      await expect(next.locator('h1')).toHaveText('Version 2')
      await next.close()
    } finally {
      if (!page.isClosed()) await page.close()
      await site.close()
    }
  })
}
