import rss from '@astrojs/rss'
import { getSortedPosts } from '@utils/content-utils'
import { getPostUrlBySlug } from '@utils/url-utils'
import type { APIContext } from 'astro'
import MarkdownIt from 'markdown-it'
import sanitizeHtml from 'sanitize-html'
import { siteConfig } from '@/config'

const parser = new MarkdownIt()

export async function GET(context: APIContext): Promise<Response> {
  const blog = await getSortedPosts()

  return rss({
    title: siteConfig.title,
    description: siteConfig.subtitle || 'No description',
    site: context.site ?? 'https://fuwari.vercel.app',
    items: blog.map(post => {
      return {
        title: post.data.title,
        pubDate: post.data.published,
        description: post.data.description || '',
        link: getPostUrlBySlug(post.id),
        content: sanitizeHtml(parser.render(post.body ?? ''), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
        }),
      }
    }),
    customData: `<language>${siteConfig.lang}</language>`,
  })
}
