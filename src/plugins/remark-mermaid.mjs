import { visit } from 'unist-util-visit'

/**
 * Turn Mermaid fences into plain containers before Expressive Code handles code blocks.
 */
export function remarkMermaid() {
  return tree => {
    visit(tree, 'code', node => {
      if (node.lang?.toLowerCase() !== 'mermaid') {
        return
      }

      const source = node.value
      node.type = 'paragraph'
      node.children = [{ type: 'text', value: source }]
      node.data = {
        hName: 'div',
        hProperties: {
          className: ['mermaid-diagram'],
          dataMermaidSource: source,
          role: 'img',
          ariaLabel: 'Mermaid 图表',
        },
      }
      delete node.lang
      delete node.meta
      delete node.value
    })
  }
}
