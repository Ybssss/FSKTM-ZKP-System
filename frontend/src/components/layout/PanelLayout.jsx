import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
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
  UserCircle,
  Menu, // 👈 Added Menu icon for mobile
  X, // 👈 Added X icon for closing
} from "lucide-react";

export default function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // 👈 New state to track if mobile menu is open
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    {
      to: "/panel/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
    {
      to: "/panel/evaluation",
      icon: ClipboardCheck,
      label: "Evaluations",
      allowedRoles: ["admin", "panel"],
    },
    {
      to: "/panel/rubrics",
      icon: FileText,
      label: "Rubrics",
      allowedRoles: ["admin", "panel"],
    },
    {
      to: "/panel/sessions",
      icon: Calendar,
      label: "Sessions",
      allowedRoles: ["admin", "panel"],
    },
    {
      to: "/panel/attendance",
      icon: CalendarCheck,
      label: "Attendance",
      allowedRoles: ["admin", "panel"],
    },
    {
      to: "/panel/historical-feedback",
      icon: Search,
      label: "Feedback",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
    {
      to: "/panel/users",
      icon: Users,
      label: "Users",
      allowedRoles: ["admin"],
    },
    {
      to: "/panel/assignments",
      icon: UserCog,
      label: "Assignments",
      allowedRoles: ["admin"],
    },
    {
      to: "/panel/devices",
      icon: Smartphone,
      label: "My Devices",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
    {
      to: "/panel/profile",
      icon: UserCircle,
      label: "Profile",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
  ];

  const filteredNavItems = navItems.filter(
    (item) => user && item.allowedRoles.includes(user.role),
  );
  const formatRole = (role) => {
    if (!role) return "Staff";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* 📱 MOBILE OVERLAY */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 🚀 RESPONSIVE SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl md:shadow-lg flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">FSKTM Symposium</h1>
            <p className="text-sm text-gray-600 mt-1">
              {formatRole(user?.role)} Portal
            </p>
          </div>
          {/* Mobile Close Button */}
          <button
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold uppercase">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.name || "Loading..."}
              </p>
              <p className="text-xs text-gray-600 truncate">{user?.userId}</p>
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
                  onClick={() => setIsSidebarOpen(false)} // 👈 Auto-close on mobile click
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100"
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

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        {/* 📱 MOBILE HEADER */}
        <header className="md:hidden bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-800">
              {formatRole(user?.role)} Portal
            </h1>
          </div>
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase">
            {user?.name?.charAt(0) || "U"}
          </div>
        </header>

        {/* Scrollable Main Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
