import {
  Bell,
  CalendarCheck,
  Compass,
  History,
  Home,
  ScanLine,
  Settings,
  Sprout,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the compact mobile bar (others live in the "More" menu). */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, mobile: true },
  { to: '/scan', label: 'Scan a plant', icon: ScanLine, mobile: false },
  { to: '/history', label: 'History', icon: History, mobile: true },
  { to: '/garden', label: 'My Garden', icon: Sprout, mobile: false },
  { to: '/care', label: 'Care & streaks', icon: CalendarCheck, mobile: true },
  { to: '/connections', label: 'Community', icon: Users, mobile: false },
  { to: '/notifications', label: 'Inbox', icon: Bell, mobile: false },
  { to: '/explore', label: 'Explorer', icon: Compass, mobile: false },
  { to: '/settings', label: 'Settings', icon: Settings, mobile: false },
];
