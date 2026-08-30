import { expect, test } from '@playwright/test'
import { collectPageProblems, expectNoHorizontalOverflow } from './helpers'

test('最近更新页面按更新时间展示文章', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto('/updated/')

  await expect(page).toHaveTitle(/最近更新/)
  const posts = page.locator('main a[href^="/posts/"]')
  await expect(posts).toHaveCount(3)
  await expect(posts.nth(0)).toHaveAttribute('href', /dubbo学习笔记/)
  await expect(posts.nth(1)).toHaveAttribute('href', /dubbo-consumer/)
  await expect(posts.nth(2)).toHaveAttribute('href', /dubbo服务调试调用/)
  await expect(page.locator('main')).toContainText('08-30')
  await expect(page.locator('main')).toContainText('08-29')
  await expect(page.locator('main')).toContainText('08-28')
  await expectNoHorizontalOverflow(page)
  expect(problems).toEqual([])
})

test('系列文章显示进度、相邻文章和相关推荐', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto(
    '/posts/学习笔记/spring/dubbo-consumer-服务引用与代理创建流程/',
  )

  const series = page.locator('section[aria-labelledby="series-heading"]')
  await expect(series).toContainText('Dubbo 2.6.x 学习')
  await expect(series).toContainText('2 / 3')
  await expect(series).toContainText('系列上一篇')
  await expect(series).toContainText('系列下一篇')

  const related = page.locator('section[aria-labelledby="related-heading"]')
  await expect(related).toBeVisible()
  expect(await related.locator('a').count()).toBeLessThanOrEqual(3)
  await expect(page.locator('article')).toContainText('发布于 2026-08-15')
  await expect(page.locator('article')).toContainText('更新于 2026-08-29')
  await expectNoHorizontalOverflow(page)
  expect(problems).toEqual([])
})

test('搜索可以按分类和年份筛选', async ({ page }, testInfo) => {
  const problems = collectPageProblems(page)

  await page.goto('/')
  if (testInfo.project.name === 'mobile') {
    await page.locator('#search-switch').click()
  } else {
    await page.locator('#search-bar input').focus()
  }

  const category = page.getByLabel('分类')
  await expect(category.locator('option')).not.toHaveCount(1)
  await category.selectOption('学习笔记')
  await expect(
    page.getByLabel('标签').locator('option[value="Java"]'),
  ).toHaveText('Java (14)')
  await expect(
    page.getByLabel('年份').locator('option[value="2026"]'),
  ).toHaveText('2026 (7)')
  await page.getByLabel('年份').selectOption('2026')

  const results = page.locator('#search-panel a')
  await expect(results.first()).toBeVisible()
  expect(await results.count()).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: '清除筛选' })).toBeVisible()
  await page.getByRole('button', { name: '清除筛选' }).click()
  await expect(category).toHaveValue('')
  await expect(page.getByLabel('年份')).toHaveValue('')

  const input = page.locator(
    testInfo.project.name === 'mobile'
      ? '#search-bar-inside input'
      : '#search-bar input',
  )
  await input.fill('这是一个不可能命中的搜索词')
  await expect(page.getByRole('status')).toHaveText('没有找到匹配的文章')
  expect(problems).toEqual([])
})

test('ClientRouter 连续导航会更新页面且不会重复初始化', async ({
  page,
}, testInfo) => {
  const problems = collectPageProblems(page)
  const clickNavLink = async (href: string) => {
    if (testInfo.project.name === 'mobile') {
      await page.locator('#nav-menu-switch').click()
      await page.locator(`#nav-menu-panel a[href="${href}"]`).click()
      return
    }
    await page.locator(`#navbar .md\\:flex a[href="${href}"]`).click()
  }

  await page.goto('/')
  await clickNavLink('/archive/')
  await expect(page).toHaveURL(/\/archive\/$/)
  await clickNavLink('/updated/')
  await expect(page).toHaveURL(/\/updated\/$/)

  const firstPost = page.locator('main a[href^="/posts/"]').first()
  await firstPost.click()
  await expect(page).toHaveURL(/\/posts\//)
  await expect(page.locator('article h1')).toBeVisible()
  await expect(page.locator('#banner img')).toHaveAttribute('src', /banner10/)
  await page.goBack()
  await expect(page).toHaveURL(/\/updated\/$/)
  await clickNavLink('/about/')
  await expect(page).toHaveURL(/\/about\/$/)
  await expect(page.locator('.custom-md h1')).toBeVisible()
  expect(problems).toEqual([])
})
