import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import svelte from '@astrojs/svelte'
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections'
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import expressiveCode from 'astro-expressive-code'
import icon from 'astro-icon'
import Color from 'colorjs.io'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeComponents from 'rehype-components' /* Render the custom directive content */
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import remarkDirective from 'remark-directive' /* Handle directives */
import remarkGfm from 'remark-gfm'
import remarkGithubAdmonitionsToDirectives from 'remark-github-admonitions-to-directives'
import remarkMath from 'remark-math'
import { expressiveCodeConfig } from './src/config.ts'
import { AdmonitionComponent } from './src/plugins/rehype-component-admonition.mjs'
import { GithubCardComponent } from './src/plugins/rehype-component-github-card.mjs'
import { rehypeWrapTables } from './src/plugins/rehype-wrap-tables.mjs'
import { remarkDemotePostHeadings } from './src/plugins/remark-demote-post-headings.mjs'
import { parseDirectiveNode } from './src/plugins/remark-directive-rehype.js'
import { remarkExcerpt } from './src/plugins/remark-excerpt.js'
import { remarkMermaid } from './src/plugins/remark-mermaid.mjs'
import { remarkNormalizeCodeLang } from './src/plugins/remark-normalize-code-lang.mjs'
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs'

const oklchToHex = str => {
  const DEFAULT_HUE = 250
  const regex = /-?\d+(\.\d+)?/g
  const matches = str.string.match(regex)
  const lch = [matches[0], matches[1], DEFAULT_HUE]
  return new Color('oklch', lch).to('srgb').toString({
    format: 'hex',
  })
}

// https://astro.build/config
export default defineConfig({
  site: 'https://mj3622.github.io',
  base: '/',
  trailingSlash: 'always',
  image: {
    layout: 'constrained',
  },
  integrations: [
    icon({
      include: {
        'material-symbols': ['*'],
        'fa6-brands': ['*'],
        'fa6-regular': ['*'],
        'fa6-solid': ['*'],
      },
    }),
    expressiveCode({
      themes: [expressiveCodeConfig.theme, expressiveCodeConfig.theme],
      plugins: [pluginCollapsibleSections(), pluginLineNumbers()],
      defaultProps: {
        wrap: true,
        overridesByLang: {
          shellsession: {
            showLineNumbers: false,
          },
        },
      },
      styleOverrides: {
        codeBackground: 'var(--codeblock-bg)',
        borderRadius: '0.75rem',
        borderColor: 'none',
        codeFontSize: '0.875rem',
        codeFontFamily:
          "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        codeLineHeight: '1.5rem',
        frames: {
          editorBackground: 'var(--codeblock-bg)',
          terminalBackground: 'var(--codeblock-bg)',
          terminalTitlebarBackground: 'var(--codeblock-topbar-bg)',
          editorTabBarBackground: 'var(--codeblock-topbar-bg)',
          editorActiveTabBackground: 'none',
          editorActiveTabIndicatorBottomColor: 'var(--primary)',
          editorActiveTabIndicatorTopColor: 'none',
          editorTabBarBorderBottomColor: 'var(--codeblock-topbar-bg)',
          terminalTitlebarBorderBottomColor: 'none',
        },
        textMarkers: {
          delHue: 0,
          insHue: 180,
          markHue: 250,
        },
      },
    }),
    svelte(),
    sitemap(),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkMath,
        remarkGfm,
        remarkDemotePostHeadings,
        remarkNormalizeCodeLang,
        remarkReadingTime,
        remarkExcerpt,
        remarkGithubAdmonitionsToDirectives,
        remarkDirective,
        parseDirectiveNode,
        remarkMermaid,
      ],
      rehypePlugins: [
        rehypeKatex,
        rehypeSlug,
        rehypeWrapTables(),
        [
          rehypeComponents,
          {
            components: {
              github: GithubCardComponent,
              note: (x, y) => AdmonitionComponent(x, y, 'note'),
              tip: (x, y) => AdmonitionComponent(x, y, 'tip'),
              important: (x, y) => AdmonitionComponent(x, y, 'important'),
              caution: (x, y) => AdmonitionComponent(x, y, 'caution'),
              warning: (x, y) => AdmonitionComponent(x, y, 'warning'),
            },
          },
        ],
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: {
              className: ['anchor'],
            },
            content: {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['anchor-icon'],
                'data-pagefind-ignore': true,
              },
              children: [
                {
                  type: 'text',
                  value: '#',
                },
              ],
            },
          },
        ],
      ],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // temporarily suppress this warning
          if (
            warning.message.includes('is dynamically imported by') &&
            warning.message.includes('but also statically imported by')
          ) {
            return
          }
          warn(warning)
        },
      },
    },
    css: {
      preprocessorOptions: {
        stylus: {
          define: {
            oklchToHex: oklchToHex,
          },
        },
      },
    },
  },
})
