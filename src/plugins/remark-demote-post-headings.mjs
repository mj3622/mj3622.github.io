import { visit } from 'unist-util-visit'

/**
 * Reserve h1 for the article title when a post already uses h1 headings.
 * Posts that start at h2 keep their original hierarchy.
 */
export function remarkDemotePostHeadings() {
  return (tree, file) => {
    const filePath = file.path?.replace(/\\/g, '/') || ''
    if (!filePath.includes('/content/posts/')) return

    let hasLevelOneHeading = false
    visit(tree, 'heading', node => {
      if (node.depth === 1) hasLevelOneHeading = true
    })

    if (!hasLevelOneHeading) return

    visit(tree, 'heading', node => {
      node.depth = Math.min(node.depth + 1, 6)
    })
  }
}
