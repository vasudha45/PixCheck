import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Play, History, Settings, Hexagon,
  ChevronRight, Zap
} from 'lucide-react';
import styles from './Layout.module.css';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/run', icon: Play, label: 'New Run' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Hexagon size={22} className={styles.logoIcon} strokeWidth={1.5} />
          <span className={styles.logoText}>PixelCheck</span>
          <span className={styles.logoBadge}>v1</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
              <ChevronRight size={12} className={styles.navChevron} />
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.apiStatus}>
            <Zap size={12} />
            <span>Claude Vision ready</span>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
