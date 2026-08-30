<script lang="ts">
import I18nKey from '@i18n/i18nKey'
import { i18n } from '@i18n/translation'
import Icon from '@iconify/svelte'
import { onMount } from 'svelte'

export let title: string
export let url: string

let copyState: 'idle' | 'success' | 'error' = 'idle'
let canShare = false
let qrDataUrl = ''
let copyTimer: ReturnType<typeof setTimeout> | undefined

onMount(() => {
  canShare = typeof navigator.share === 'function'
  return () => {
    if (copyTimer) clearTimeout(copyTimer)
  }
})

async function copyLink() {
  let succeeded = false
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url)
      succeeded = true
    } catch {
      // Continue with the local fallback below.
    }
  }

  if (!succeeded) {
    const textarea = document.createElement('textarea')
    textarea.value = url
    textarea.readOnly = true
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    try {
      succeeded = document.execCommand('copy')
    } catch {
      succeeded = false
    } finally {
      textarea.remove()
    }
  }

  copyState = succeeded ? 'success' : 'error'
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyState = 'idle'
  }, 1_500)
  return succeeded
}

async function share() {
  if (canShare) {
    try {
      await navigator.share({ title, url })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }
  await copyLink()
}

async function toggleQrCode() {
  if (qrDataUrl) {
    qrDataUrl = ''
    return
  }
  const QRCode = await import('qrcode')
  qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  })
}
</script>

<div class="relative flex flex-wrap gap-2">
    {#if canShare}
        <button onclick={share} class="btn-regular rounded-lg h-10 px-4 active:scale-95">
            <Icon icon="material-symbols:share-outline" class="text-xl mr-2" />
            {i18n(I18nKey.share)}
        </button>
    {/if}
    <button onclick={copyLink} class="btn-regular rounded-lg h-10 px-4 active:scale-95">
        <Icon icon={copyState === 'success' ? 'material-symbols:check-rounded' : copyState === 'error' ? 'material-symbols:error-outline-rounded' : 'material-symbols:link-rounded'} class="text-xl mr-2" />
        {copyState === 'success' ? i18n(I18nKey.copied) : copyState === 'error' ? i18n(I18nKey.copyFailed) : i18n(I18nKey.copyLink)}
    </button>
    <button onclick={toggleQrCode} aria-expanded={Boolean(qrDataUrl)} class="btn-regular rounded-lg h-10 px-4 active:scale-95">
        <Icon icon="material-symbols:qr-code-2-rounded" class="text-xl mr-2" />
        {i18n(I18nKey.qrCode)}
    </button>

    {#if qrDataUrl}
        <div class="absolute z-30 bottom-12 left-0 p-3 rounded-xl bg-white shadow-xl border border-black/10">
            <img src={qrDataUrl} alt={`${title} ${i18n(I18nKey.qrCode)}`} width="240" height="240" />
        </div>
    {/if}
</div>
