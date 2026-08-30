<script lang="ts">
import I18nKey from '@i18n/i18nKey'
import { i18n } from '@i18n/translation'
import Icon from '@iconify/svelte'
import { onMount } from 'svelte'

let state: Window['pwaState']
let dismissTimer: ReturnType<typeof setTimeout> | undefined

function setState(nextState: Window['pwaState']) {
  state = nextState
  if (dismissTimer) clearTimeout(dismissTimer)
  if (nextState === 'offline-ready') {
    dismissTimer = setTimeout(() => {
      state = undefined
    }, 4_000)
  }
}

onMount(() => {
  setState(window.pwaState)
  const offlineReady = () => {
    setState('offline-ready')
  }
  const needRefresh = () => {
    setState('need-refresh')
  }
  document.addEventListener('pwa:offline-ready', offlineReady)
  document.addEventListener('pwa:need-refresh', needRefresh)
  return () => {
    if (dismissTimer) clearTimeout(dismissTimer)
    document.removeEventListener('pwa:offline-ready', offlineReady)
    document.removeEventListener('pwa:need-refresh', needRefresh)
  }
})

async function refresh() {
  await window.updateServiceWorker?.()
}
</script>

{#if state}
    <aside class="fixed z-[100] bottom-4 left-1/2 -translate-x-1/2 w-[min(24rem,calc(100vw-2rem))]
        card-base shadow-xl p-3 flex items-center gap-3" aria-live="polite">
        <Icon icon={state === 'need-refresh' ? 'material-symbols:system-update-alt-rounded' : 'material-symbols:offline-pin-rounded'}
              class="text-2xl text-[var(--primary)] shrink-0" />
        <span class="text-sm text-75 flex-1">
            {state === 'need-refresh' ? i18n(I18nKey.newVersionAvailable) : i18n(I18nKey.offlineReady)}
        </span>
        {#if state === 'need-refresh'}
            <button onclick={refresh} class="btn-regular rounded-lg h-8 px-3 text-sm">{i18n(I18nKey.refresh)}</button>
        {/if}
        <button onclick={() => setState(undefined)} aria-label="Close" class="btn-plain rounded-lg w-8 h-8">
            <Icon icon="material-symbols:close-rounded" class="text-lg" />
        </button>
    </aside>
{/if}
