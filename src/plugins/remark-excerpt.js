import { toString as nodeToString } from 'mdast-util-to-string'

/* Use the post's first paragraph as the excerpt */
export function remarkExcerpt() {
  return (tree, { data }) => {
    let excerpt = ''
    for (const node of tree.children) {
      if (node.type !== 'paragraph') {
        continue
      }
      excerpt = nodeToString(node)
      break
    }
    data.astro.frontmatter.excerpt = excerpt
  }
}
