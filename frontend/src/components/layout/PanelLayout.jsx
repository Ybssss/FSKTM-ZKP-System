import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import UserAvatar from "../UserAvatar";
import {
  HISTORICAL_REQUESTS_UPDATED_EVENT,
} from "../../utils/historicalRequestEvents";
import {
  countUnseenRequestUpdates,
} from "../../utils/historicalRequestBadgeState";
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
  Menu,
  X,
  BookOpen,
  History,
} from "lucide-react";

export default function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historicalRequestCounts, setHistoricalRequestCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const canTrackHistoricalRequests = useMemo(
    () => ["admin", "panel"].includes(user?.role),
    [user?.role],
  );
  const requestBadgeUserKey = String(
    user?._id || user?.id || user?.userId || "",
  ).trim();

  const loadHistoricalRequestCounts = useCallback(async () => {
    if (!canTrackHistoricalRequests) {
      setHistoricalRequestCounts({ pending: 0, approved: 0, rejected: 0 });
      return;
    }

    try {
      const [myRes, incomingRes] = await Promise.all([
        api.get("/feedback/permissions/my"),
        api.get("/feedback/permissions/incoming?status=PENDING"),
      ]);

      const myRequests = myRes.data?.requests || [];
      const incomingPending = incomingRes.data?.requests || [];

      setHistoricalRequestCounts({
        pending: incomingPending.length,
        approved: countUnseenRequestUpdates(
          myRequests,
          requestBadgeUserKey,
          "APPROVED",
        ),
        rejected: countUnseenRequestUpdates(
          myRequests,
          requestBadgeUserKey,
          "REJECTED",
        ),
      });
    } catch (error) {
      console.error("Failed to load historical request counts:", error);
    }
  }, [canTrackHistoricalRequests, requestBadgeUserKey]);

  useEffect(() => {
    if (!canTrackHistoricalRequests) return undefined;

    const handleRefresh = () => {
      loadHistoricalRequestCounts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadHistoricalRequestCounts();
      }
    };

    const initialRefreshTimer = window.setTimeout(handleRefresh, 0);

    window.addEventListener(HISTORICAL_REQUESTS_UPDATED_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(initialRefreshTimer);
      window.removeEventListener(
        HISTORICAL_REQUESTS_UPDATED_EVENT,
        handleRefresh,
      );
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [canTrackHistoricalRequests, loadHistoricalRequestCounts]);

  const navItems = [
    {
      to: "/panel/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
    {
      to: "/panel/sessions",
      icon: Calendar,
      label: "Session Management",
      allowedRoles: ["admin", "panel", "coordinator"],
    },
    {
      to: "/panel/assignments",
      icon: FileText,
      label: "Panel Assignments",
      allowedRoles: ["superadmin", "admin", "coordinator"],
    },
    {
      to: "/panel/evaluation",
      icon: ClipboardCheck,
      label: "Evaluation Forms",
      allowedRoles: ["superadmin", "admin", "panel"],
    },
    {
      to: "/panel/historical-feedback",
      icon: History,
      label: "Historical Vault",
      allowedRoles: ["superadmin", "admin", "panel"],
    },
    {
      to: "/panel/rubrics",
      icon: BookOpen,
      label: "Rubrics",
      allowedRoles: ["superadmin", "admin", "panel"],
    },
    {
      to: "/panel/users",
      icon: Users,
      label: "Users",
      allowedRoles: ["superadmin", "admin"],
    },
    {
      to: "/panel/devices",
      icon: Smartphone,
      label: "Devices",
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
    (item) =>
      user && item.allowedRoles && item.allowedRoles.includes(user.role),
  );

  const formatRole = (role) => {
    if (!role) return "Staff";
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const requestBadgeItems = [
    {
      key: "pending",
      count: historicalRequestCounts.pending,
      className: "bg-amber-100 text-amber-800 border border-amber-200",
      title: "Requests waiting for your action",
    },
    {
      key: "approved",
      count: historicalRequestCounts.approved,
      className: "bg-green-100 text-green-800 border border-green-200",
      title: "Approved updates to my requests",
    },
    {
      key: "rejected",
      count: historicalRequestCounts.rejected,
      className: "bg-red-100 text-red-800 border border-red-200",
      title: "Rejected updates to my requests",
    },
  ].filter((badge) => badge.count > 0);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
          <button
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 bg-indigo-50">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={user}
              className="w-10 h-10 rounded-full overflow-hidden bg-indigo-600"
              imgClassName="w-full h-full rounded-full object-contain bg-white p-0.5"
              fallbackClassName="w-full h-full rounded-full flex items-center justify-center bg-indigo-600 text-white font-semibold uppercase"
            />
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

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {filteredNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="font-medium truncate">{item.label}</span>
                      </div>
                      {item.to === "/panel/historical-feedback" &&
                        requestBadgeItems.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0 pl-2">
                            {requestBadgeItems.map((badge) => (
                              <span
                                key={badge.key}
                                title={badge.title}
                                className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none ${
                                  isActive
                                    ? badge.className
                                    : badge.className
                                }`}
                              >
                                {badge.count}
                              </span>
                            ))}
                          </div>
                        )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
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
          <UserAvatar
            user={user}
            className="w-8 h-8 rounded-full overflow-hidden bg-indigo-600"
            imgClassName="w-full h-full rounded-full object-contain bg-white p-0.5"
            fallbackClassName="w-full h-full rounded-full flex items-center justify-center bg-indigo-600 text-white font-bold text-xs uppercase"
          />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
