/**
 * Rehype plugin that wraps each <table> element in a
 * <div class="table-wrapper"> container for overflow scrolling.
 *
 * This enables tables to use native `display: table` layout
 * (which fills container width) while keeping horizontal scroll
 * behavior on the wrapper div.
 */
export function rehypeWrapTables() {
  return tree => {
    const tables = []
    // Walk the tree manually rather than using unist-util-visit,
    // because visit() crashes on undefined nodes that can appear
    // in the AST after rehype-katex processes math with CJK punctuation.
    function collectTables(node, parent, index) {
      if (!node || typeof node !== 'object') return
      if (node.type === 'element' && node.tagName === 'table') {
        // Skip tables already wrapped in a table-wrapper
        if (
          parent?.type === 'element' &&
          parent?.tagName === 'div' &&
          parent?.properties?.className?.includes('table-wrapper')
        ) {
          return
        }
        tables.push({ node, parent, index })
        // Don't recurse into tables
        return
      }
      if (Array.isArray(node.children)) {
        for (let i = 0; i < node.children.length; i++) {
          collectTables(node.children[i], node, i)
        }
      }
    }

    collectTables(tree, null, null)

    // Replace in reverse order to avoid index shifts
    for (let i = tables.length - 1; i >= 0; i--) {
      const { node, parent, index: idx } = tables[i]
      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrapper'] },
        children: [node],
      }
      parent.children[idx] = wrapper
    }
  }
}
