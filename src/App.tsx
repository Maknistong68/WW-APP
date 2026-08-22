import { HashRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import InfoFormPage from './pages/InfoFormPage'
import ChecklistPage from './pages/ChecklistPage'
import KpisPage from './pages/KpisPage'
import ToastHost from './components/Toast'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new/:templateId" element={<InfoFormPage mode="new" />} />
        <Route path="/inspection/:id" element={<ChecklistPage />} />
        <Route path="/inspection/:id/edit" element={<InfoFormPage mode="edit" />} />
        <Route path="/kpis" element={<KpisPage />} />
      </Routes>
      <ToastHost />
    </HashRouter>
  )
}
