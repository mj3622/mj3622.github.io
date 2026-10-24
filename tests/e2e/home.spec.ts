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
  await expect(page.locator('#banner img')).toHaveAttribute('src', /banner-sakura/)
  await expectNoHorizontalOverflow(page)
  if (!process.env.CI) {
    await expect(page.locator('#navbar')).toHaveScreenshot('navbar.png')
  }
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
  if (!process.env.CI) {
    await expect(page.locator('#navbar')).toHaveScreenshot('mobile-menu.png')
  }
  expect(problems).toEqual([])
})

test('横幅在站内切换和返回后保持取景与布局', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') {
    await page.setViewportSize({ width: 1462, height: 804 })
  }
  const problems = collectPageProblems(page)
  await page.goto('/')
  await waitForVisualStability(page)
  await page.locator('#banner').evaluate(async banner => {
    await Promise.all(banner.getAnimations().map(animation => animation.finished))
  })

  const initial = await page.evaluate(() => ({
    timeOrigin: performance.timeOrigin,
    offset: document.documentElement.style.getPropertyValue(
      '--banner-height-extend',
    ),
    bannerTop: document.querySelector('#banner')!.getBoundingClientRect().top,
    gridTop: document.querySelector('#main-grid')!.getBoundingClientRect().top,
  }))
  expect(parseFloat(initial.offset)).toBeGreaterThan(0)
  const article = page.locator('#main-container a[href^="/posts/"]').first()
  const articleURL = await article.getAttribute('href')
  await article.click()
  await page.waitForURL(url => decodeURI(url.pathname) === decodeURI(articleURL!))
  await expect(page.locator('#banner img')).toHaveAttribute(
    'src',
    /banner-sakura-compact/,
  )
  await expect(page.locator('#banner')).toHaveClass(/banner-compact/)
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(
    initial.timeOrigin,
  )
  await expect(page.locator('html')).toHaveCSS(
    '--banner-height-extend',
    initial.offset,
  )
  await waitForVisualStability(page)
  await page.screenshot({
    path: testInfo.outputPath('article.png'),
    animations: 'disabled',
  })

  await page.goBack()
  await page.waitForURL('/')
  await expect(page.locator('#banner img')).toHaveAttribute(
    'src',
    /banner-sakura\./,
  )
  await expect(page.locator('#banner')).not.toHaveClass(/banner-compact/)
  await expect
    .poll(async () => {
      const banner = await page.locator('#banner').boundingBox()
      const grid = await page.locator('#main-grid').boundingBox()
      return Math.max(
        Math.abs(banner!.y - initial.bannerTop),
        Math.abs(grid!.y - initial.gridTop),
      )
    })
    .toBeLessThan(2)
  await expect(page.locator('html')).toHaveCSS(
    '--banner-height-extend',
    initial.offset,
  )

  await article.click()
  await page.waitForURL(url => decodeURI(url.pathname) === decodeURI(articleURL!))
  await page.getByRole('link', { name: 'Minjer', exact: true }).click()
  await page.waitForURL('/')
  await expect
    .poll(async () => (await page.locator('#main-grid').boundingBox())!.y)
    .toBeCloseTo(initial.gridTop, 0)
  await expect(page.locator('html')).toHaveCSS(
    '--banner-height-extend',
    initial.offset,
  )
  await expectNoHorizontalOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('home-return.png'),
    animations: 'disabled',
  })
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
