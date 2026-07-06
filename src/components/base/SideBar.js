import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiGrid,
  FiUsers,
  FiBell,
  FiSettings,
  FiCreditCard,
  FiFolder,
  FiUser,
  FiX,
  FiDollarSign
} from 'react-icons/fi';
import { useAuth } from '@/lib/AuthProvider';

const SideBar = ({ collapsed, mobileOpen, onMobileClose }) => {
  const pathname = usePathname();
  const { user } = useAuth();

  // Close mobile drawer on route change
  useEffect(() => {
    if (mobileOpen) onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navItems = [
    { icon: <FiGrid size={20} />, label: 'Dashboard', link: '/', description: 'Overview & analytics' },
    { icon: <FiUsers size={20} />, label: 'Members', link: '/members', description: 'Manage members' },
    { icon: <FiUser size={20} />, label: 'Agents', link: '/agents', description: 'Agent management' },
    { icon: <FiBell size={20} />, label: 'Yojna', link: '/yojna', description: 'Schemes & programs' },
    { icon: <FiDollarSign size={20} />, label: 'Closing Payments', link: '/closingPayments', description: 'Closing payments' },
    { icon: <FiCreditCard size={20} />, label: 'Payments', link: '/transactions', description: 'Payment history' },
  ];

  const systemItems = [
    { icon: <FiSettings size={20} />, label: 'Settings', link: '/setting', description: 'App configuration' },
  ];

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  // Tooltip for collapsed state (desktop only)
  const Tooltip = ({ children, label }) => (
    <div className="relative group">
      {children}
      {collapsed && (
        <div className="hidden lg:block absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 top-1/2 -translate-y-1/2 shadow-lg">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </div>
  );

  const NavList = ({ items }) => (
    <ul className="space-y-1 px-3">
      {items.map((item, index) => {
        const active = isActive(item.link);
        return (
          <li key={index}>
            <Tooltip label={item.label}>
              <Link
                href={item.link}
                className={`flex items-center px-3.5 py-2.5 rounded-xl transition-all duration-200 ease-in-out group relative
                  ${active
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 !text-white shadow-md shadow-blue-600/25'
                    : 'text-gray-600 hover:bg-blue-50/70 hover:text-blue-700'
                  }
                  ${collapsed ? 'lg:justify-center lg:px-3' : ''}
                `}
              >
                <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`}>
                  {item.icon}
                </span>

                <div className={`ml-3.5 flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                  <span className="text-sm font-semibold block leading-tight">{item.label}</span>
                  <span className={`text-[11px] mt-0.5 block ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                    {item.description}
                  </span>
                </div>

                {active && (
                  <span className={`w-1.5 h-1.5 bg-white rounded-full flex-shrink-0 ${collapsed ? 'lg:hidden' : ''}`}></span>
                )}
              </Link>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`bg-white flex flex-col border-r border-gray-200/80
        fixed inset-y-0 left-0 z-40 w-72 shadow-2xl
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:shadow-none lg:z-20 lg:transition-all
        ${collapsed ? 'lg:w-20' : 'lg:w-72'}
      `}
    >
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
        <div className={`flex items-center min-w-0 ${collapsed ? 'lg:justify-center lg:w-full' : ''}`}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/30 flex-shrink-0">
            <FiFolder size={20} className="text-white" />
          </div>
          <div className={`ml-3 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <h2 className="font-bold text-base text-gray-800 truncate leading-tight">Marudhar Admin</h2>
            <p className="text-[11px] text-gray-400">Admin Panel</p>
          </div>
        </div>

        {/* Close button — mobile/tablet only */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Close sidebar"
        >
          <FiX size={20} />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-grow py-5 overflow-y-auto overflow-x-hidden">
        <div className="mb-6">
          <p className={`px-6 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${collapsed ? 'lg:hidden' : ''}`}>
            Main Menu
          </p>
          <NavList items={navItems} />
        </div>

        <div>
          <p className={`px-6 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider ${collapsed ? 'lg:hidden' : ''}`}>
            System
          </p>
          <NavList items={systemItems} />
        </div>
      </nav>

      {/* User Profile Section */}
      <div className={`border-t border-gray-100 p-3 flex-shrink-0 ${collapsed ? 'lg:p-3' : ''}`}>
        <div className={`flex items-center rounded-xl bg-gray-50/80 p-2.5 ${collapsed ? 'lg:justify-center lg:bg-transparent lg:p-1' : ''}`}>
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white shadow-md">
              {user?.username ? (
                <span className="font-semibold text-sm">{user.username.charAt(0).toUpperCase()}</span>
              ) : (
                <FiUser size={16} />
              )}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
          </div>

          <div className={`ml-3 min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
              {user?.username || 'User'}
            </p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">
              {user?.email || 'admin@trustmanager.com'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SideBar;
