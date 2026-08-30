import { expect, test } from '@playwright/test'
import { collectPageProblems, expectNoHorizontalOverflow } from './helpers'

test('中文搜索可以返回文章结果', async ({ page }, testInfo) => {
  const problems = collectPageProblems(page)

  await page.goto('/')
  const isMobile = testInfo.project.name === 'mobile'
  if (isMobile) {
    await page.locator('#search-switch').click()
  }

  const input = page.locator(
    isMobile ? '#search-bar-inside input' : '#search-bar input',
  )
  await input.fill('Dubbo')

  const results = page.locator('#search-panel a')
  await expect(results.first()).toBeVisible()
  expect(await results.count()).toBeGreaterThanOrEqual(3)
  await expect(results.first()).toContainText('Dubbo')
  await expectNoHorizontalOverflow(page)
  if (!process.env.CI) {
    await expect(page.locator('#search-panel')).toHaveScreenshot('search.png')
  }
  expect(problems).toEqual([])
})
