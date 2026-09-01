const SELECTOR = '.mermaid-diagram'

let renderQueue = Promise.resolve()

function getTheme(): 'dark' | 'default' {
  return document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'default'
}

async function renderMermaidDiagrams(): Promise<void> {
  const theme = getTheme()
  const diagrams = Array.from(
    document.querySelectorAll<HTMLElement>(SELECTOR),
  ).filter(diagram => diagram.dataset.mermaidTheme !== theme)

  if (diagrams.length === 0) {
    return
  }

  await document.fonts.ready
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme,
  })

  for (const diagram of diagrams) {
    const source = diagram.dataset.mermaidSource
    if (!source) {
      continue
    }

    diagram.textContent = source
    diagram.removeAttribute('data-processed')

    try {
      await mermaid.run({ nodes: [diagram], suppressErrors: false })
      diagram.dataset.mermaidTheme = theme
    } catch (error) {
      diagram.removeAttribute('data-processed')
      diagram.classList.add('mermaid-diagram-error')
      diagram.textContent = source
      console.error('Mermaid 图表渲染失败', error)
    }
  }
}

function queueRender(): void {
  renderQueue = renderQueue.then(renderMermaidDiagrams, renderMermaidDiagrams)
}

queueRender()
document.addEventListener('astro:page-load', queueRender)

new MutationObserver(queueRender).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class'],
})
