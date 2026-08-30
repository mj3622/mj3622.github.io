import { expect, type Page } from '@playwright/test'

export function collectPageProblems(page: Page): string[] {
  const problems: string[] = []

  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', error => {
    problems.push(`pageerror: ${error.message}`)
  })

  return problems
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport)
}

export async function waitForVisualStability(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images)
        .filter(image => {
          const rect = image.getBoundingClientRect()
          return image.loading !== 'lazy' || rect.top < window.innerHeight * 1.5
        })
        .map(image => {
          if (image.complete) return Promise.resolve()
          return new Promise<void>(resolve => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          })
        }),
    )
  })
}
