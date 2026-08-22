import { HashRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import NewInspectionPage from './pages/NewInspectionPage'
import ChecklistPage from './pages/ChecklistPage'
import KpisPage from './pages/KpisPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new/:templateId" element={<NewInspectionPage />} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/kpis" element={<KpisPage />} />
      </Routes>
    </HashRouter>
  )
}
