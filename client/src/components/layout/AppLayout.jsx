import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import LivePanel from './LivePanel.jsx';
import { useApp } from '../../context/AppContext.jsx';

export default function AppLayout() {
  const { settings } = useApp();
  const { pathname } = useLocation();
  const browserFocus = pathname.startsWith('/browser'); // browser page = full screen, no sidebar / top bar
  const showPanel = settings.showLivePanel && (pathname === '/' || pathname.startsWith('/useful') || pathname.startsWith('/history'));
  return (
    <div className={`app-shell ${settings.sidebarCollapsed ? 'sb-collapsed' : ''} ${showPanel ? 'with-panel' : ''} ${browserFocus ? 'browser-focus' : ''}`}>
      {!browserFocus && <Sidebar />}
      <div className="main-col">
        {!browserFocus && <Topbar />}
        <main className={`main-scroll ${pathname.startsWith('/browser') ? 'full-bleed' : ''}`} key={pathname.split('/')[1]}>
          <div className="page-enter"><Outlet /></div>
        </main>
      </div>
      {showPanel && <LivePanel />}
    </div>
  );
}
