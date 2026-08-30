import { expect, test } from '@playwright/test'
import { collectPageProblems } from './helpers'

test('PWA 清单和 Service Worker 可以注册', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const problems = collectPageProblems(page)

  await page.goto('/')

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  const worker = await page.request.get('/sw.js')
  expect(worker.ok()).toBe(true)
  await page.evaluate(() => navigator.serviceWorker.ready)
  expect(problems).toEqual([])
})

test('访问过的文章可以离线重新打开', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const article = '/posts/经验分享/rss自动追番/'

  await page.goto(article)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect(page.locator('article h1')).toHaveText('利用RSS实现自动追番')

  await context.setOffline(true)
  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('article h1')).toHaveText('利用RSS实现自动追番')
  } finally {
    await context.setOffline(false)
  }
})
