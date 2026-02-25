import { STORAGE_KEYS } from '../../../shared/storage/keys'

export const WISHLIST_KEY = STORAGE_KEYS.wishlist.items
export const STORAGE_MODE_KEY = STORAGE_KEYS.wishlist.storageMode
export const NOTIFY_KEY = STORAGE_KEYS.wishlist.notifyEnabled
export const ONEDRIVE_HANDLE_KEY = STORAGE_KEYS.wishlist.oneDriveHandle
export const WISHLIST_FILE = 'gamedivers-wishlist.json'
export const STEAM_NAME_CACHE_KEY = STORAGE_KEYS.steam.wishlistNameCache
export const STEAM_WISHLIST_SHADOW_CACHE_KEY = STORAGE_KEYS.steam.wishlistShadowCache
export const ITAD_LOOKUP_CACHE_KEY = STORAGE_KEYS.wishlist.itadLookupCache
export const CHECK_INTERVAL_MINUTES = 30
export const ITAD_MIN_REQUEST_INTERVAL_MS = 900
export const ITAD_RATE_RETRY_DELAYS_MS = [1200, 2400, 3600] as const
export const DEFAULT_CURRENCY = 'EUR'
