import type { WishlistItem } from '../../../types'
import { parseWishlist } from './normalize'
import { WISHLIST_FILE } from './constants'
import type { DirectoryHandle, PermissionMode } from './types'

export async function readWishlistFile(handle: DirectoryHandle): Promise<WishlistItem[] | null> {
  try {
    const fileHandle = await handle.getFileHandle(WISHLIST_FILE)
    const file = await fileHandle.getFile()
    const text = await file.text()
    return parseWishlist(text)
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return []
    console.error('Failed to read wishlist file:', error)
    return null
  }
}

export async function writeWishlistFile(handle: DirectoryHandle, items: WishlistItem[]): Promise<void> {
  const fileHandle = await handle.getFileHandle(WISHLIST_FILE, { create: true })
  const stream = await fileHandle.createWritable()
  await stream.write(JSON.stringify(items, null, 2))
  await stream.close()
}

export async function ensurePermission(
  handle: DirectoryHandle,
  mode: PermissionMode,
  prompt: boolean,
): Promise<boolean> {
  const query = await handle.queryPermission({ mode })
  if (query === 'granted') return true
  if (!prompt) return false
  const request = await handle.requestPermission({ mode })
  return request === 'granted'
}

export function getPicker(): (() => Promise<DirectoryHandle>) | null {
  if (typeof window === 'undefined') return null
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> })
    .showDirectoryPicker
  return picker ?? null
}
