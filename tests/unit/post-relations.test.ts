import { describe, expect, it } from 'vitest'
import {
  getRelatedPosts,
  getSeriesContext,
  type PostEntry,
  validateSeries,
} from '../../src/utils/post-relations'

function post(
  id: string,
  options: {
    tags?: string[]
    series?: string
    seriesOrder?: number
    published?: string
    draft?: boolean
  } = {},
): PostEntry {
  return {
    id,
    collection: 'posts',
    data: {
      title: id,
      published: new Date(options.published ?? '2026-01-01'),
      draft: options.draft ?? false,
      description: '',
      image: '',
      tags: options.tags ?? [],
      category: 'Test',
      lang: '',
      series: options.series ?? '',
      seriesOrder: options.seriesOrder,
      prevTitle: '',
      prevSlug: '',
      nextTitle: '',
      nextSlug: '',
    },
  } as PostEntry
}

describe('validateSeries', () => {
  it('rejects a series without an order', () => {
    expect(() => validateSeries([post('one', { series: 'Guide' })])).toThrow(
      'has no seriesOrder',
    )
  })

  it('rejects duplicate order values in one series', () => {
    expect(() =>
      validateSeries([
        post('one', { series: 'Guide', seriesOrder: 1 }),
        post('two', { series: 'Guide', seriesOrder: 1 }),
      ]),
    ).toThrow('uses order 1')
  })

  it('accepts posts without a series and independent series orders', () => {
    expect(() =>
      validateSeries([
        post('standalone'),
        post('guide-one', { series: 'Guide', seriesOrder: 1 }),
        post('other-one', { series: 'Other', seriesOrder: 1 }),
      ]),
    ).not.toThrow()
  })
})

describe('getSeriesContext', () => {
  it('returns ordered neighbours and progress', () => {
    const posts = [
      post('third', { series: 'Guide', seriesOrder: 3 }),
      post('first', { series: 'Guide', seriesOrder: 1 }),
      post('second', { series: 'Guide', seriesOrder: 2 }),
    ]

    const context = getSeriesContext(posts[2], posts)

    expect(context).toMatchObject({
      name: 'Guide',
      position: 2,
      total: 3,
      previous: { id: 'first' },
      next: { id: 'third' },
    })
  })
})

describe('getRelatedPosts', () => {
  it('prioritizes the same series, then shared tags and recency', () => {
    const current = post('current', {
      tags: ['Astro', 'Blog'],
      series: 'Guide',
      seriesOrder: 2,
    })
    const posts = [
      current,
      post('same-series', {
        tags: [],
        series: 'Guide',
        seriesOrder: 1,
      }),
      post('two-tags', {
        tags: ['Astro', 'Blog'],
        published: '2025-01-01',
      }),
      post('one-tag-newer', {
        tags: ['Astro'],
        published: '2026-01-01',
      }),
      post('draft', { tags: ['Astro', 'Blog'], draft: true }),
    ]

    expect(getRelatedPosts(current, posts).map(item => item.id)).toEqual([
      'same-series',
      'two-tags',
      'one-tag-newer',
    ])
  })

  it('excludes the current post and drafts and respects the result limit', () => {
    const current = post('current', { tags: ['Astro'] })
    const posts = [
      current,
      post('newest', { tags: ['Astro'], published: '2026-03-01' }),
      post('older', { tags: ['Astro'], published: '2026-02-01' }),
      post('draft', { tags: ['Astro'], draft: true }),
    ]

    expect(getRelatedPosts(current, posts, 1).map(item => item.id)).toEqual([
      'newest',
    ])
  })
})
