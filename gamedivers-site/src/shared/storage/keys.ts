export const STORAGE_KEYS = {
  app: {
    theme: 'theme',
    lang: 'lang',
    libraryView: 'libraryView',
    storeRegion: 'storeRegion',
    showWishlist: 'showWishlist',
    priceCache: 'priceCache',
  },
  auth: {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    user: 'user',
  },
  steam: {
    id: 'steamId',
    username: 'steamUsername',
    wishlistNameCache: 'steamWishlistNameCache',
    wishlistShadowCache: 'steamWishlistShadowCache',
  },
  epic: {
    id: 'epicId',
    username: 'epicUsername',
    accessToken: 'epicAccessToken',
  },
  wishlist: {
    items: 'wishlist',
    storageMode: 'wishlistStorageMode',
    notifyEnabled: 'wishlistNotifyEnabled',
    oneDriveHandle: 'wishlistOnedriveHandle',
    itadLookupCache: 'wishlistItadLookupCache',
  },
} as const
