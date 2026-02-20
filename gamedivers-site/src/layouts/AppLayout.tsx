import type { ReactNode } from 'react'
import type { DesignLayoutPreset } from '../designs/themeManifest'

type AppLayoutProps = {
  preset: DesignLayoutPreset
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
}

function renderDefaultLayout(sidebar: ReactNode, header: ReactNode, children: ReactNode) {
  return (
    <div className="relative z-10 flex min-h-screen">
      {sidebar}
      <main className="flex-1 px-6 py-8 lg:px-10">
        <div className="mb-6">{header}</div>
        {children}
      </main>
    </div>
  )
}

function renderMeadowLayout(sidebar: ReactNode, header: ReactNode, children: ReactNode) {
  return (
    <div className="relative z-10 min-h-screen px-3 py-4 lg:px-6 lg:py-5">
      <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-5 lg:self-start">{sidebar}</div>
        <main className="grid gap-4 lg:grid-rows-[auto,1fr]">
          <section className="ui-surface ui-surface--accent">
            <div className="ui-panel ui-panel-pad-sm">{header}</div>
          </section>
          <section className="ui-surface">
            <div className="ui-panel ui-panel-pad-md min-h-[70vh]">{children}</div>
          </section>
        </main>
      </div>
    </div>
  )
}

function renderKawaiiLayout(sidebar: ReactNode, header: ReactNode, children: ReactNode) {
  return (
    <div className="relative z-10 min-h-screen px-2 py-3 sm:px-4 sm:py-4">
      <div className="flex min-h-[calc(100vh-1.5rem)] flex-col gap-4 lg:flex-row">
        <div className="lg:sticky lg:top-4 lg:self-start">{sidebar}</div>
        <main className="grid flex-1 gap-4 lg:grid-rows-[auto,1fr]">
          <section className="ui-surface ui-surface--accent">
            <div className="ui-panel ui-panel-pad-sm">{header}</div>
          </section>
          <section className="ui-surface">
            <div className="ui-panel ui-panel-pad-md min-h-[70vh]">{children}</div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default function AppLayout({ preset, sidebar, header, children }: AppLayoutProps) {
  if (preset === 'meadow') {
    return renderMeadowLayout(sidebar, header, children)
  }
  if (preset === 'kawaii') {
    return renderKawaiiLayout(sidebar, header, children)
  }
  return renderDefaultLayout(sidebar, header, children)
}
