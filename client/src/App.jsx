import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import Toasts from './components/ui/Toasts.jsx';
import PremiumModal from './components/ui/PremiumModal.jsx';
import Home from './pages/Home.jsx';
import ProblemSolver from './pages/ProblemSolver.jsx';
import LiveAI from './pages/LiveAI.jsx';
import CreativeStudio from './pages/CreativeStudio.jsx';
import MakeUseful from './pages/MakeUseful.jsx';
import HistoryPage from './pages/History.jsx';
import SettingsPage from './pages/Settings.jsx';
import WebBrowser from './pages/WebBrowser.jsx';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/live" element={<LiveAI />} />
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="/solver" element={<ProblemSolver />} />
          <Route path="/solver/:id" element={<ProblemSolver />} />
          <Route path="/studio" element={<CreativeStudio />} />
          <Route path="/useful" element={<MakeUseful />} />
          <Route path="/browser" element={<WebBrowser />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <PremiumModal />
      <Toasts />
    </>
  );
}
