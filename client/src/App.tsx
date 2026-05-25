import { useState } from 'react'
import MainMenu from './components/menu/MainMenu'
import OfficeScene from './game/OfficeScene'
import CreditsScreen from './components/screens/CreditsScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import HowToPlayScreen from './components/screens/HowToPlayScreen'
import NewGameScreen from './components/screens/NewGameScreen'
import JoinGameScreen from './components/screens/JoinGameScreen'
import LobbyScreen from './components/screens/LobbyScreen'
import GameScreen from './components/screens/GameScreen'
import BriefingScreen from './components/screens/BriefingScreen'
import MeetingScreen from './components/screens/MeetingScreen'
import RetroScreen from './components/screens/RetroScreen'
import SpectatorScreen from './components/screens/SpectatorScreen'
import { useTheme } from './store/useTheme'

export type Screen =
  | 'main-menu' | 'new-game' | 'join-game' | 'lobby' | 'briefing'
  | 'game' | 'meeting' | 'retro' | 'spectator'
  | 'settings' | 'how-to-play' | 'credits'

export default function App() {
  const [screen, setScreen] = useState<Screen>('main-menu')
  const { theme } = useTheme()

  return (
    <div data-theme={theme} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D background — only on menus/briefing (not in-game or spectating) */}
      {screen !== 'game' && screen !== 'meeting' && screen !== 'retro' && screen !== 'spectator' && <OfficeScene />}

      {/* UI overlay */}
      {screen === 'main-menu'   && <MainMenu onNavigate={setScreen} />}
      {screen === 'credits'     && <CreditsScreen onNavigate={setScreen} />}
      {screen === 'settings'    && <SettingsScreen onNavigate={setScreen} />}
      {screen === 'how-to-play' && <HowToPlayScreen onNavigate={setScreen} />}
      {screen === 'new-game'    && <NewGameScreen onNavigate={setScreen} />}
      {screen === 'join-game'   && <JoinGameScreen onNavigate={setScreen} />}
      {screen === 'lobby'       && <LobbyScreen onNavigate={setScreen} />}
      {screen === 'briefing'    && <BriefingScreen onNavigate={setScreen} />}
      {screen === 'game'        && <GameScreen onNavigate={setScreen} />}
      {screen === 'meeting'     && <MeetingScreen onNavigate={setScreen} />}
      {screen === 'retro'       && <RetroScreen onNavigate={setScreen} />}
      {screen === 'spectator'   && <SpectatorScreen onNavigate={setScreen} />}
    </div>
  )
}
