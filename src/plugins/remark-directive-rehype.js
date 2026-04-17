import { h } from 'hastscript'
import { visit } from 'unist-util-visit'

export function parseDirectiveNode() {
  return tree => {
    visit(tree, node => {
      if (
        node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
      ) {
        const nodeData = node.data || {}
        if (!node.data) {
          node.data = nodeData
        }
        node.attributes = node.attributes || {}
        if (
          node.children.length > 0 &&
          node.children[0].data &&
          node.children[0].data.directiveLabel
        ) {
          // Add a flag to the node to indicate that it has a directive label
          node.attributes['has-directive-label'] = true
        }
        const hast = h(node.name, node.attributes)

        nodeData.hName = hast.tagName
        nodeData.hProperties = hast.properties
      }
    })
  }
}
