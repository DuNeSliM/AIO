export type ViewMode = 'grid' | 'list'

export type Theme = 'dark' | 'light'

export type Page = 'library' | 'store' | 'settings' | 'downloads'

export type Game = {
  id?: string | number
  name: string
  platform?: string
  image?: string
  appId?: string
  appName?: string
  gameName?: string
  lastPlayed?: number
  playtime?: number
}

export type ItadPrice = {
  amount?: number
  amountInt?: number
  currency?: string
}

export type ItadDeal = {
  price?: ItadPrice
  shop?: {
    name?: string
  }
  cut?: number
  url?: string
}

export type ItadSearchItem = {
  id: string
  title: string
}

export type ItadPriceItem = {
  id: string
  deals?: ItadDeal[]
  shop?: {
    name?: string
  }
}

export type ItadPricesResponse =
  | ItadPriceItem[]
  | {
      games?: Record<string, ItadPriceItem>
    }
