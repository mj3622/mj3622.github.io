import { expect, test } from '@playwright/test'

test('未配置 Token 时不加载访问统计', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const analyticsRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('cloudflareinsights.com')) {
      analyticsRequests.push(request.url())
    }
  })

  await page.goto('/')

  await expect(
    page.locator('script[src*="cloudflareinsights.com"]'),
  ).toHaveCount(0)
  expect(analyticsRequests).toEqual([])
})
