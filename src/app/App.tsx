import { Route, Routes } from 'react-router'
import { DebugPage } from '../pages/DebugPage'
import { HomePage } from '../pages/HomePage'
import { PathPage } from '../pages/PathPage'
import { ReadPage } from '../pages/ReadPage'
import { SessionPage } from '../pages/SessionPage'
import { SettingsPage } from '../pages/SettingsPage'
import { StyleguidePage } from '../pages/StyleguidePage'
import { AppShell } from './AppShell'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="path" element={<PathPage />} />
        <Route path="read/:lessonId" element={<ReadPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="styleguide" element={<StyleguidePage />} />
        <Route path="debug" element={<DebugPage />} />
      </Route>
      {/* Sessions are full-screen: no sidebar, nothing to distract. */}
      <Route path="session" element={<SessionPage />} />
    </Routes>
  )
}
