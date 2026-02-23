import type { WishlistItem } from '../../../types'

export type StorageMode = 'local' | 'onedrive'
export type OnedriveStatus = 'unsupported' | 'disconnected' | 'permission-required' | 'connected'
export type DirectoryHandle = any
export type PermissionMode = 'read' | 'readwrite'

export type WishlistAlert = {
  id: string
  message: string
  createdAt: number
}

export type ItadLookupCacheEntry = {
  id: string
  title?: string
}

export type ItadLookupCache = Record<string, ItadLookupCacheEntry>

export type WishlistDealSummary = NonNullable<WishlistItem['dealsTop3']>[number]
