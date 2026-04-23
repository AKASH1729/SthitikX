/**
 * Layout — FINAL ✅
 * Shows only: Company ID and Email for all users.
 */

import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import logo from "../../assets/logo.jpeg";
import { FiUser, FiMail, FiBriefcase } from "react-icons/fi";

const NAV_ITEMS = [
  {
    section: "Super Admin",
    roles: ["super_admin"],
    items: [{ to: "/app/super-admin", label: "Companies" }],
  },
  {
    section: "Management",
    roles: ["admin"],
    items: [
      { to: "/app/dashboard", label: "Dashboard" },
      { to: "/app/live-map", label: "Live Map" },
      { to: "/app/employees", label: "Employees" },
      { to: "/app/salary-slips", label: "Salary" },
      { to: "/app/attendance", label: "Attendance" },
      { to: "/app/geofences", label: "Geofences" },
      { to: "/app/alerts", label: "Alerts" },
      { to: "/app/upload-excel", label: "Upload Data" },
	{ to: "/app/billing", label: "Billing " },
    ],
  },
  {
    section: "My Space",
    roles: ["employee"],
    items: [
      { to: "/app/attendance", label: "Attendance" },
      { to: "/app/uploads", label: "My Uploads" },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const role = user?.role;

  // Fetch profile data (only Company ID and Email)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setProfileData({
            companyId: data.company?._id || "N/A",
            email: data.email,
          });
        } else {
          // Fallback using AuthContext
          setProfileData({
            companyId: user?.company?._id || user?.companyId || "N/A",
            email: user?.email,
          });
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setProfileData({
          companyId: user?.company?._id || user?.companyId || "N/A",
          email: user?.email,
        });
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // Responsive & scroll handlers
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const visibleItems = NAV_ITEMS.filter((section) =>
    section.roles.includes(role)
  ).flatMap((section) => section.items);

  const handleNavClick = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <style>
        {`
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
          }
          .nav-link {
            position: relative;
            transition: all 0.2s ease;
          }
          .nav-link.active {
            color: #2563eb;
            font-weight: 600;
          }
          .nav-link.active::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border-radius: 2px;
            animation: fadeInDown 0.2s ease-out;
          }
          .nav-link:hover:not(.active) {
            color: #1e40af;
            transform: translateY(-1px);
          }
          .mobile-nav-link.active {
            background: linear-gradient(135deg, #eff6ff, #f3e8ff);
            color: #2563eb;
            font-weight: 600;
            border-left: 3px solid #3b82f6;
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in-up {
            animation: fadeInUp 0.4s ease-out;
          }
        `}
      </style>

      {/* Navbar */}
      <nav
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-lg"
            : "bg-white shadow-md"
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo + Brand */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-pulse opacity-75"></div>
                <img
                  src={logo}
                  alt="logo"
                  className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-md transition-transform duration-300 hover:scale-105"
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SthitiX
              </span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `nav-link px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200 ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              {/* User Avatar + Dropdown */}
              <div className="ml-4 relative group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md transition-transform group-hover:scale-105 cursor-pointer">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  {/* Header */}
                  <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{user?.name}</p>
                        <p className="text-xs text-gray-500">
                          {role === "super_admin"
                            ? "Super Admin"
                            : role === "admin"
                            ? "Admin"
                            : "Employee"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details – Only Company ID and Email */}
                  <div className="p-4 space-y-3">
                    {profileLoading ? (
                      <div className="flex justify-center py-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <>
                        {/* Company ID */}
                        <div className="flex items-center gap-2 text-sm">
                          <FiBriefcase className="text-gray-400" />
                          <span className="text-gray-600">Company ID:</span>
                          <span className="font-mono text-xs text-gray-700">{profileData?.companyId}</span>
                        </div>
                        {/* Email */}
                        <div className="flex items-center gap-2 text-sm">
                          <FiMail className="text-gray-400" />
                          <span className="text-gray-600">Email:</span>
                          <span className="text-gray-800 truncate">{profileData?.email}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 focus:outline-none"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg animate-slide-right">
            <div className="px-4 py-3 space-y-1">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    `mobile-nav-link block px-4 py-2.5 rounded-lg text-gray-700 transition-all duration-200 ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="border-t border-gray-100 my-2"></div>
              {/* Mobile Profile Summary – Only Company ID and Email */}
              <div className="px-4 py-2 bg-gray-50 rounded-lg mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                    <p className="text-xs text-gray-500">{profileData?.email}</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <p><strong>Company ID:</strong> {profileData?.companyId}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span
                      className={`absolute inline-flex h-2 w-2 rounded-full ${
                        isConnected ? "bg-green-500" : "bg-red-500"
                      } opacity-75 animate-ping`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        isConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></span>
                  </div>
                  <span className="text-xs text-gray-600">{isConnected ? "Live" : "Offline"}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full mt-2 px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="animate-fade-in-up">
          <Outlet />
        </div>
      </main>

      <style>
        {`
          .animate-slide-right {
            animation: slideInRight 0.3s ease-out;
          }
          @keyframes slideInRight {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
    </div>
  );
}
