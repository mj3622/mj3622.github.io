import { getCollection } from 'astro:content'
import I18nKey from '@i18n/i18nKey'
import { i18n } from '@i18n/translation'
import {
  getRelatedPosts,
  getSeriesContext,
  type PostEntry,
  type SeriesContext,
  validateSeries,
} from './post-relations'

export { getRelatedPosts, getSeriesContext, type PostEntry, type SeriesContext }

export async function getSortedPosts(): Promise<PostEntry[]> {
  const allBlogPosts = await getCollection('posts', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })

  const sorted = allBlogPosts.sort((a, b) => {
    return b.data.published.getTime() - a.data.published.getTime()
  })

  validateSeries(sorted)

  for (let i = 1; i < sorted.length; i++) {
    sorted[i].data.nextSlug = sorted[i - 1].id
    sorted[i].data.nextTitle = sorted[i - 1].data.title
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    sorted[i].data.prevSlug = sorted[i + 1].id
    sorted[i].data.prevTitle = sorted[i + 1].data.title
  }

  return sorted
}

export async function getRecentlyUpdatedPosts(): Promise<PostEntry[]> {
  const posts = await getSortedPosts()
  return posts
    .filter(post => post.data.updated && !post.data.draft)
    .sort((a, b) => {
      return (b.data.updated?.getTime() ?? 0) - (a.data.updated?.getTime() ?? 0)
    })
}

export type Tag = {
  name: string
  count: number
}

export async function getTagList(): Promise<Tag[]> {
  const allBlogPosts = await getCollection('posts', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })

  const countMap: { [key: string]: number } = {}
  for (const post of allBlogPosts) {
    for (const tag of post.data.tags) {
      if (!countMap[tag]) countMap[tag] = 0
      countMap[tag]++
    }
  }

  // sort tags by usage count, then alphabetically for a stable order
  const keys: string[] = Object.keys(countMap).sort((a, b) => {
    return (
      countMap[b] - countMap[a] ||
      a.toLowerCase().localeCompare(b.toLowerCase())
    )
  })

  return keys.map(key => ({ name: key, count: countMap[key] }))
}

export type Category = {
  name: string
  count: number
}

export async function getCategoryList(): Promise<Category[]> {
  const allBlogPosts = await getCollection('posts', ({ data }) => {
    return import.meta.env.PROD ? data.draft !== true : true
  })
  const count: { [key: string]: number } = {}
  for (const post of allBlogPosts) {
    if (!post.data.category) {
      const ucKey = i18n(I18nKey.uncategorized)
      count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1
      continue
    }
    count[post.data.category] = count[post.data.category]
      ? count[post.data.category] + 1
      : 1
  }

  const lst = Object.keys(count).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase())
  })

  const ret: Category[] = []
  for (const c of lst) {
    ret.push({ name: c, count: count[c] })
  }
  return ret
}
