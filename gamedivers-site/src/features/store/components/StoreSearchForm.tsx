import type { FormEvent } from 'react'
import UiCorners from '../../../components/ui/UiCorners'
import { useI18n } from '../../../i18n/i18n'

const STORE_REGIONS = ['DE', 'US', 'GB', 'FR', 'ES', 'IT', 'NL', 'PL', 'SE', 'NO', 'FI', 'DK', 'CA', 'AU'] as const

type StoreSearchFormProps = {
  query: string
  region: string
  loading: boolean
  onQueryChange: (query: string) => void
  onRegionChange: (region: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function StoreSearchForm({
  query,
  region,
  loading,
  onQueryChange,
  onRegionChange,
  onSubmit,
}: StoreSearchFormProps) {
  const { t } = useI18n()

  return (
    <form className="ui-surface" onSubmit={onSubmit}>
      <div className="ui-panel flex flex-wrap items-center gap-3 ui-panel-pad-md">
        <UiCorners />
        <input
          className="ui-input flex-1"
          type="text"
          placeholder={t('store.searchPlaceholder')}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <span className="ui-label">{t('store.region')}</span>
        <select
          className="ui-select"
          value={region}
          onChange={(event) => onRegionChange(event.target.value)}
        >
          {STORE_REGIONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry === 'GB' ? 'UK' : entry}
            </option>
          ))}
        </select>
        <button type="submit" className="ui-btn-primary" disabled={loading}>
          {t('store.search')}
        </button>
      </div>
    </form>
  )
}
