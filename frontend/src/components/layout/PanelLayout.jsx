import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Calendar, 
  Users, 
  CalendarCheck, 
  Search, 
  LogOut,
  Smartphone,
  QrCode,
  UserCog,
  UserCircle
} from 'lucide-react';

export default function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Define navigation items with precise Role-Based Access Control
  const navItems = [
    { to: '/panel/dashboard', icon: LayoutDashboard, label: 'Dashboard', allowedRoles: ['admin', 'panel', 'coordinator'] },
    { to: '/panel/evaluation', icon: ClipboardCheck, label: 'Evaluations', allowedRoles: ['admin', 'panel'] },
    { to: '/panel/rubrics', icon: FileText, label: 'Rubrics', allowedRoles: ['admin', 'panel'] },
    { to: '/panel/sessions', icon: Calendar, label: 'Sessions', allowedRoles: ['admin', 'panel'] },
    { to: '/panel/attendance', icon: CalendarCheck, label: 'Attendance', allowedRoles: ['admin', 'panel'] },
    { to: '/panel/historical-feedback', icon: Search, label: 'Feedback', allowedRoles: ['admin', 'panel', 'coordinator'] },
    { to: '/panel/qr-generator', icon: QrCode, label: 'QR Generator', allowedRoles: ['admin', 'panel'] },
    { to: '/panel/users', icon: Users, label: 'Users', allowedRoles: ['admin'] },
    { to: '/panel/assignments', icon: UserCog, label: 'Assignments', allowedRoles: ['admin'] },
    { to: '/panel/devices', icon: Smartphone, label: 'My Devices', allowedRoles: ['admin', 'panel', 'coordinator'] },
    { to: '/panel/profile', icon: UserCircle, label: 'Profile', allowedRoles: ['admin', 'panel', 'coordinator'] },
  ];

  // Filter nav items based on the user's current role
  const filteredNavItems = navItems.filter(item => 
    user && item.allowedRoles.includes(user.role)
  );

  // Helper to format the role nicely for the UI (e.g., "coordinator" -> "Coordinator")
  const formatRole = (role) => {
    if (!role) return 'Staff';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">FSKTM Symposium</h1>
          <p className="text-sm text-gray-600 mt-1">
            {formatRole(user?.role)} Portal
          </p>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold uppercase">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.name || 'Loading...'}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {user?.userId}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded bg-indigo-100 text-indigo-800">
                {formatRole(user?.role)}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}