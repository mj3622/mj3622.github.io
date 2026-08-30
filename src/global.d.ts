type PagefindResultData = {
  url: string
  excerpt: string
  meta: { title: string }
}

type PagefindFilters = Record<string, Record<string, number>>

type PagefindAPI = {
  filters: () => Promise<PagefindFilters>
  init: () => Promise<void> | void
  options: (options: Record<string, unknown>) => Promise<void>
  search: (
    term: string | null,
    options?: { filters?: Record<string, string> },
  ) => Promise<{
    results: Array<{ data: () => Promise<PagefindResultData> }>
    filters?: PagefindFilters
  }>
}

declare global {
  interface Window {
    pagefind?: PagefindAPI
    pwaState?: 'offline-ready' | 'need-refresh'
    updateServiceWorker?: () => Promise<void>
  }
}

export {}
