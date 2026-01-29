import React from 'react'
import Sidebar from './components/Sidebar'
import GameLibrary from './pages/GameLibrary'

export default function App(){
  return (
    <div className="app-root">
      <Sidebar />
      <main className="app-main">
        <GameLibrary />
      </main>
    </div>
  )
}
