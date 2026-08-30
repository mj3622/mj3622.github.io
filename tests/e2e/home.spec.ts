import { expect, test } from '@playwright/test'
import {
  collectPageProblems,
  expectNoHorizontalOverflow,
  waitForVisualStability,
} from './helpers'

test('首页保持稳定的语义和响应式布局', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto('/')
  await waitForVisualStability(page)

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('nav')).toHaveCount(1)
  await expect(page.locator('footer')).toHaveCount(1)
  await expect(page.locator('#banner img')).toHaveAttribute('src', /banner10/)
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('#navbar')).toHaveScreenshot('navbar.png')
  expect(problems).toEqual([])
})

test('移动端菜单和点击区域可用', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile')
  const problems = collectPageProblems(page)

  await page.goto('/')
  await page.locator('#nav-menu-switch').click()

  await expect(page.locator('#nav-menu-panel')).not.toHaveClass(
    /float-panel-closed/,
  )
  for (const selector of [
    '#search-switch',
    '#display-settings-switch',
    '#scheme-switch',
    '#nav-menu-switch',
  ]) {
    const box = await page.locator(selector).boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  await expect(page.locator('#navbar')).toHaveScreenshot('mobile-menu.png')
  expect(problems).toEqual([])
})

test('主题模式可以循环切换', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto('/')
  await page.locator('#scheme-switch').click()
  await page.locator('#scheme-switch').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.locator('#scheme-switch').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(problems).toEqual([])
})

test('显示设置面板和减少动效偏好生效', async ({ page }) => {
  const problems = collectPageProblems(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await page.locator('#display-settings-switch').click()
  await expect(page.locator('#display-setting')).not.toHaveClass(
    /float-panel-closed/,
  )
  await expect(page.getByRole('slider', { name: '主题色' })).toBeVisible()
  await expect(page.locator('.onload-animation').first()).toHaveCSS(
    'animation-name',
    'none',
  )
  expect(problems).toEqual([])
})
