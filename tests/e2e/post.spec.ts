import { expect, test } from '@playwright/test'
import {
  collectPageProblems,
  expectNoHorizontalOverflow,
  waitForVisualStability,
} from './helpers'

const postWithCover = '/posts/经验分享/rss自动追番/'
const postWithCode =
  '/posts/学习笔记/spring/dubbo-consumer-服务引用与代理创建流程/'

test('文章封面不会替换全站 Banner', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto(postWithCover)
  await waitForVisualStability(page)

  const images = await page.evaluate(() => {
    const banner = document.querySelector<HTMLImageElement>('#banner img')
    const cover = document.querySelector<HTMLImageElement>('#post-cover img')
    return {
      banner: banner?.currentSrc,
      cover: cover?.currentSrc,
    }
  })
  expect(images.banner).toContain('banner10')
  expect(images.cover).toContain('rss')
  expect(images.banner).not.toBe(images.cover)
  await expect(page.locator('#banner img')).toHaveAttribute('srcset', /640w/)
  await expect(page.locator('#banner img')).toHaveAttribute('sizes', '100vw')
  await expect(page.locator('#banner img')).toHaveAttribute(
    'fetchpriority',
    'high',
  )
  await expect(page.locator('#post-cover img')).toHaveAttribute(
    'srcset',
    /640w/,
  )
  await expect(page.locator('#post-cover img')).toHaveAttribute(
    'sizes',
    /calc\(100vw - 3rem\)/,
  )
  await expect(page.locator('#post-cover img')).toHaveAttribute(
    'loading',
    'lazy',
  )
  await expect(page.locator('article h1')).toHaveText('利用RSS实现自动追番')
  await expectNoHorizontalOverflow(page)
  expect(problems).toEqual([])
})

test('无封面和非系列文章不渲染空面板', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto('/posts/学习笔记/spring/dubbo学习笔记/')
  await expect(page.locator('#post-cover')).toHaveCount(0)

  await page.goto(postWithCover)
  await expect(
    page.locator('section[aria-labelledby="series-heading"]'),
  ).toHaveCount(0)
  expect(
    await page.locator('section[aria-labelledby="related-heading"] a').count(),
  ).toBeLessThanOrEqual(3)
  expect(problems).toEqual([])
})

test('代码块保留行号和复制操作', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto(postWithCode)

  const codeBlocks = page.locator('.expressive-code')
  await expect(codeBlocks.first()).toBeVisible()
  expect(await codeBlocks.count()).toBeGreaterThan(0)
  expect(
    await page.locator('.expressive-code .gutter .ln').count(),
  ).toBeGreaterThan(0)
  expect(
    await page
      .locator('.expressive-code button[title="Copy to clipboard"]')
      .count(),
  ).toBe(await codeBlocks.count())
  await expect(page.locator('#post-container').first()).toHaveScreenshot(
    'article-code.png',
  )
  expect(problems).toEqual([])
})

test('图片灯箱提供稳定的关闭按钮', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop')
  const problems = collectPageProblems(page)

  await page.goto(postWithCover)
  await page.locator('#post-cover img').click()

  await expect(page.locator('.pswp--open')).toBeVisible()
  const closeButton = page.locator('.pswp__button--close')
  await expect(closeButton).toBeVisible()
  await page.waitForTimeout(400)
  const box = await closeButton.boundingBox()
  expect(box?.width).toBe(48)
  expect(box?.height).toBe(48)
  await closeButton.click()
  await expect(page.locator('.pswp--open')).toBeHidden()
  expect(problems).toEqual([])
})
