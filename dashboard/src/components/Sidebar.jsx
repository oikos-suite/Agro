import { Activity, Server, Library, BarChart3, Settings, ShieldCheck } from 'lucide-react';
import Avatar from '../Avatar.jsx';
import AgroLogo from './AgroLogo.jsx';

/** Every page, in one flat list: no menus, no hidden entries. */
export const NAV_ITEMS = [
  { id: 'social', label: 'Social', icon: Activity },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'devices', label: 'Devices', icon: Server },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'management', label: 'Server', icon: ShieldCheck, adminOnly: true }
];

export default function Sidebar({ activeTab, onTabSelect, username, isAdmin }) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const activeIndex = visibleItems.findIndex((item) => item.id === activeTab);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <AgroLogo size={30} />
        <span>Agro</span>
      </div>

      <nav className="sidebar-nav">
        {/* One pill for the whole list, sprung to the active row, so changing tab reads as motion. */}
        {activeIndex >= 0 && (
          <span className="nav-indicator" style={{ '--nav-index': activeIndex }} aria-hidden="true" />
        )}
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onTabSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-who">
          <Avatar username={username} size={22} />
          <span className="sidebar-who-name">{username || '…'}</span>
          {isAdmin && <span className="role-chip">admin</span>}
        </div>
        <div className="user-badge-version">{import.meta.env.VITE_AGRO_VERSION}</div>
      </div>
    </aside>
  );
}
