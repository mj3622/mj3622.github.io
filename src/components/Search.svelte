<script lang="ts">
import I18nKey from '@i18n/i18nKey'
import { i18n } from '@i18n/translation'
import Icon from '@iconify/svelte'
import { url } from '@utils/url-utils.ts'
import { onMount } from 'svelte'

type SearchResult = {
  url: string
  meta: { title: string }
  excerpt: string
}

type FilterValues = Record<string, number>

let keywordDesktop = ''
let keywordMobile = ''
let result: SearchResult[] = []
let allFilters: Record<string, FilterValues> = {}
let availableFilters: Record<string, FilterValues> = {}
let selectedCategory = ''
let selectedTag = ''
let selectedYear = ''
let filtersActive = false
let hasSearched = false
let searching = false
let searchRevision = 0

const fakeResult: SearchResult[] = [
  {
    url: url('/'),
    meta: { title: 'This Is a Fake Search Result' },
    excerpt:
      'Because the search cannot work in the <mark>dev</mark> environment.',
  },
  {
    url: url('/'),
    meta: { title: 'If You Want to Test the Search' },
    excerpt: 'Try running <mark>pnpm build && pnpm preview</mark> instead.',
  },
]

const sortedFilters = (
  total: FilterValues | undefined,
  available: FilterValues | undefined,
  descending = false,
) => {
  const values = new Set([
    ...Object.keys(total ?? {}),
    ...Object.keys(available ?? {}),
  ])
  const entries = Array.from(
    values,
    value => [value, available?.[value] ?? 0] as const,
  )
  return entries.sort(([left], [right]) =>
    descending ? right.localeCompare(left) : left.localeCompare(right),
  )
}

const selectedFilters = () => {
  const filters: Record<string, string> = {}
  if (selectedCategory) filters.category = selectedCategory
  if (selectedTag) filters.tag = selectedTag
  if (selectedYear) filters.year = selectedYear
  return filters
}

const openPanel = () => {
  document
    .getElementById('search-panel')
    ?.classList.remove('float-panel-closed')
}

let search: (keyword: string, isDesktop: boolean) => void = () => {}

onMount(() => {
  const initializePagefind = async () => {
    if (!import.meta.env.PROD) {
      availableFilters = {
        category: { 学习笔记: 1 },
        tag: { Dubbo: 1 },
        year: { 2026: 1 },
      }
      allFilters = availableFilters
      return
    }
    if (!window.pagefind) return

    allFilters = await window.pagefind.filters()
    availableFilters = allFilters
    await search(keywordDesktop || keywordMobile, true)
  }

  search = async (keyword: string, isDesktop: boolean) => {
    const panel = document.getElementById('search-panel')
    if (!panel) return

    const filters = selectedFilters()
    const hasQuery = keyword.trim().length > 0
    if (!hasQuery && Object.keys(filters).length === 0) {
      searchRevision += 1
      result = []
      availableFilters = allFilters
      hasSearched = false
      searching = false
      return
    }

    const revision = ++searchRevision
    searching = true
    if (import.meta.env.PROD) {
      if (!window.pagefind) return
      const response = await window.pagefind.search(keyword.trim() || null, {
        filters,
      })
      const nextResult = await Promise.all(
        response.results.map(item => item.data()),
      )
      if (revision !== searchRevision) return
      result = nextResult
      availableFilters = response.filters ?? allFilters
    } else {
      result = fakeResult
    }
    hasSearched = true
    searching = false

    if (isDesktop) panel.classList.remove('float-panel-closed')
  }

  if (window.pagefind || !import.meta.env.PROD) {
    void initializePagefind()
  } else {
    document.addEventListener('pagefindready', initializePagefind, {
      once: true,
    })
  }

  return () => {
    document.removeEventListener('pagefindready', initializePagefind)
  }
})

const togglePanel = () => {
  document
    .getElementById('search-panel')
    ?.classList.toggle('float-panel-closed')
}

const clearFilters = () => {
  selectedCategory = ''
  selectedTag = ''
  selectedYear = ''
  result = []
}

$: search(keywordDesktop, true)
$: search(keywordMobile, false)
$: {
  selectedCategory
  selectedTag
  selectedYear
  search(keywordDesktop || keywordMobile, true)
}
$: filtersActive = Boolean(selectedCategory || selectedTag || selectedYear)
</script>

<div id="search-bar" class="hidden lg:flex transition-all items-center h-11 mr-2 rounded-lg
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
">
    <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30" />
    <input placeholder={i18n(I18nKey.search)} bind:value={keywordDesktop} onfocus={openPanel}
           class="transition-all pl-10 text-sm bg-transparent outline-0
         h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50"
    >
</div>

<button onclick={togglePanel} aria-label="Search Panel" id="search-switch"
        class="btn-plain scale-animation lg:hidden rounded-lg w-[44px] h-[44px] active:scale-90">
    <Icon icon="material-symbols:search" class="text-[1.25rem]" />
</button>

<div id="search-panel" class="float-panel float-panel-closed search-panel absolute md:w-[34rem]
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10">
        <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30" />
        <input placeholder={i18n(I18nKey.search)} bind:value={keywordMobile}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0 text-black/50 dark:text-white/50">
    </div>

    {#if Object.keys(availableFilters).length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
            <select aria-label={i18n(I18nKey.categories)} bind:value={selectedCategory}
                    class="h-9 rounded-lg px-2 text-sm bg-[var(--btn-regular-bg)] text-75 outline-none">
                <option value="">{i18n(I18nKey.allCategories)}</option>
                {#each sortedFilters(allFilters.category, availableFilters.category) as [value, count]}
                    <option value={value}>{value} ({count})</option>
                {/each}
            </select>
            <select aria-label={i18n(I18nKey.tags)} bind:value={selectedTag}
                    class="h-9 rounded-lg px-2 text-sm bg-[var(--btn-regular-bg)] text-75 outline-none">
                <option value="">{i18n(I18nKey.allTags)}</option>
                {#each sortedFilters(allFilters.tag, availableFilters.tag) as [value, count]}
                    <option value={value}>{value} ({count})</option>
                {/each}
            </select>
            <select aria-label={i18n(I18nKey.year)} bind:value={selectedYear}
                    class="h-9 rounded-lg px-2 text-sm bg-[var(--btn-regular-bg)] text-75 outline-none">
                <option value="">{i18n(I18nKey.allYears)}</option>
                {#each sortedFilters(allFilters.year, availableFilters.year, true) as [value, count]}
                    <option value={value}>{value} ({count})</option>
                {/each}
            </select>
        </div>
    {/if}

    {#if filtersActive}
        <button onclick={clearFilters} class="btn-plain rounded-lg h-8 px-3 text-sm mt-2 ml-auto">
            <Icon icon="material-symbols:filter-alt-off-outline-rounded" class="text-lg mr-1" />
            {i18n(I18nKey.clearFilters)}
        </button>
    {/if}

    {#each result as item}
        <a href={item.url}
           class="transition first-of-type:mt-2 group block rounded-xl text-lg px-3 py-2
           hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
            <div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
                {item.meta.title}<Icon icon="fa6-solid:chevron-right" class="transition text-[0.75rem] translate-x-0.5 my-auto text-[var(--primary)]" />
            </div>
            <div class="transition text-sm text-50">
                {@html item.excerpt}
            </div>
        </a>
    {/each}

    {#if hasSearched && !searching && result.length === 0}
        <div class="flex items-center justify-center min-h-24 px-3 text-sm text-50" role="status">
            {i18n(I18nKey.noSearchResults)}
        </div>
    {/if}
</div>

<style>
  input:focus {
    outline: 0;
  }
</style>
