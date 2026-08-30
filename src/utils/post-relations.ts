import type { CollectionEntry } from 'astro:content'

export type PostEntry = CollectionEntry<'posts'>

export type SeriesContext = {
  name: string
  position: number
  total: number
  previous?: PostEntry
  next?: PostEntry
}

export function validateSeries(posts: PostEntry[]): void {
  const ordersBySeries = new Map<string, Map<number, string>>()

  for (const post of posts) {
    const series = post.data.series.trim()
    const order = post.data.seriesOrder

    if (!series && order !== undefined) {
      throw new Error(`Post "${post.id}" has seriesOrder but no series`)
    }
    if (!series) continue
    if (order === undefined) {
      throw new Error(
        `Post "${post.id}" belongs to "${series}" but has no seriesOrder`,
      )
    }

    const orders = ordersBySeries.get(series) ?? new Map<number, string>()
    const existing = orders.get(order)
    if (existing) {
      throw new Error(
        `Series "${series}" uses order ${order} in both "${existing}" and "${post.id}"`,
      )
    }
    orders.set(order, post.id)
    ordersBySeries.set(series, orders)
  }
}

export function getSeriesContext(
  currentPost: PostEntry,
  posts: PostEntry[],
): SeriesContext | undefined {
  const name = currentPost.data.series.trim()
  if (!name) return undefined

  const seriesPosts = posts
    .filter(post => !post.data.draft && post.data.series.trim() === name)
    .sort((a, b) => {
      return (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0)
    })
  const currentIndex = seriesPosts.findIndex(post => post.id === currentPost.id)
  if (currentIndex < 0) return undefined

  return {
    name,
    position: currentIndex + 1,
    total: seriesPosts.length,
    previous: seriesPosts[currentIndex - 1],
    next: seriesPosts[currentIndex + 1],
  }
}

export function getRelatedPosts(
  currentPost: PostEntry,
  posts: PostEntry[],
  limit = 3,
): PostEntry[] {
  const currentTags = new Set(currentPost.data.tags)
  const currentSeries = currentPost.data.series.trim()

  return posts
    .filter(post => post.id !== currentPost.id && !post.data.draft)
    .map(post => {
      const sharedTagCount = post.data.tags.filter(tag =>
        currentTags.has(tag),
      ).length
      const sameSeries =
        currentSeries.length > 0 && post.data.series.trim() === currentSeries
      return {
        post,
        score: (sameSeries ? 1_000 : 0) + sharedTagCount,
      }
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => {
      return (
        b.score - a.score ||
        b.post.data.published.getTime() - a.post.data.published.getTime() ||
        a.post.id.localeCompare(b.post.id)
      )
    })
    .slice(0, limit)
    .map(candidate => candidate.post)
}
