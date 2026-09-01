import { expect, test } from '@playwright/test'
import { collectPageProblems, expectNoHorizontalOverflow } from './helpers'

const postWithMermaid =
  '/posts/学习笔记/spring/dubbo-consumer-服务引用与代理创建流程/'

test('Mermaid 代码块渲染为响应式图表', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto(postWithMermaid)

  const diagram = page.locator('.mermaid-diagram').first()
  await expect(diagram.locator('svg')).toBeVisible()
  await expect(diagram).toHaveAttribute('data-mermaid-theme', 'default')
  await expect(
    page.locator('.expressive-code pre[data-language="mermaid"]'),
  ).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  expect(problems).toEqual([])
})

test('切换深色模式后重新渲染 Mermaid 图表', async ({ page }) => {
  const problems = collectPageProblems(page)

  await page.goto(postWithMermaid)

  const diagram = page.locator('.mermaid-diagram').first()
  await expect(diagram).toHaveAttribute('data-mermaid-theme', 'default')
  await page.locator('#scheme-switch').click()
  await page.locator('#scheme-switch').click()
  await expect(diagram).toHaveAttribute('data-mermaid-theme', 'dark')
  await expect(diagram.locator('svg')).toBeVisible()
  expect(problems).toEqual([])
})
