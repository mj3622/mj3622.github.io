import { expect, test } from '@playwright/test'
import { collectPageProblems } from './helpers'

const article = '/posts/经验分享/rss自动追番/'

test('文章支持原生分享、复制链接和本地二维码', async ({ context, page }) => {
  const problems = collectPageProblems(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        ;(window as typeof window & { sharedData?: ShareData }).sharedData =
          data
      },
    })
  })

  await page.goto(article)
  const canonicalUrl = await page
    .locator('link[rel="canonical"]')
    .getAttribute('href')
  expect(canonicalUrl).toBeTruthy()
  const shareButton = page.getByRole('button', { name: '分享', exact: true })
  await shareButton.scrollIntoViewIfNeeded()
  await shareButton.click()
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { sharedData?: ShareData }).sharedData?.url,
    ),
  ).toBe(canonicalUrl)

  await page.getByRole('button', { name: '复制链接', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '已复制', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    canonicalUrl,
  )

  const networkRequests: string[] = []
  page.on('request', request => networkRequests.push(request.url()))
  await page.getByRole('button', { name: '二维码', exact: true }).click()
  await expect(page.locator('img[alt*="二维码"]')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/,
  )
  expect(
    networkRequests.every(
      request => new URL(request).origin === new URL(page.url()).origin,
    ),
  ).toBe(true)
  expect(problems).toEqual([])
})

test('不支持原生分享和 Clipboard API 时仍可复制', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    document.execCommand = command => {
      ;(
        window as typeof window & { legacyCopiedText?: string }
      ).legacyCopiedText =
        command === 'copy' &&
        document.activeElement instanceof HTMLTextAreaElement
          ? document.activeElement.value
          : undefined
      return command === 'copy'
    }
  })

  await page.goto(article)
  await expect(
    page.getByRole('button', { name: '分享', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: '复制链接', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '已复制', exact: true }),
  ).toBeVisible()
  const canonicalUrl = await page
    .locator('link[rel="canonical"]')
    .getAttribute('href')
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { legacyCopiedText?: string })
          .legacyCopiedText,
    ),
  ).toBe(canonicalUrl)
})
