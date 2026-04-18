/**
 * LiveMapLayout — FULL PAGE, FULLY RESPONSIVE ✨
 * Covers entire screen, looks great on mobile & desktop.
 */

import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { 
  FiMapPin, FiClock, FiDownload, FiUser, FiCalendar, 
  FiBarChart2, FiActivity, FiTarget 
} from "react-icons/fi";

export default function LiveMapLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFetchingEmployees, setIsFetchingEmployees] = useState(true);

  // Role protection
  if (user?.role === "employee") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex items-center justify-center text-red-500 font-semibold text-xl p-4 text-center"
      >
        ⛔ Access Denied – Admin only.
      </motion.div>
    );
  }

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await api.get("/v2/users?limit=100");
        setEmployees(data.users || []);
      } catch (err) {
        console.log("❌ Failed to load employees");
      } finally {
        setIsFetchingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleDateChange = (value) => {
    if (value > today) {
      alert("❌ Future dates are not allowed");
      return;
    }
    setDate(value);
  };

  const handleDownload = async () => {
    if (!selectedEmployee) {
      alert("👤 Please select an employee first");
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(
        `/locations/export/${selectedEmployee}?date=${date}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${date}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("❌ Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };
  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white flex flex-col">
      {/* Header Card - sticky but not covering full screen */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 15 }}
        className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm"
      >
        <div className="w-full px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Left side */}
            <div className="w-full sm:w-auto">
              <motion.h1 
                className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2 flex-wrap"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                <FiMapPin className="text-blue-500 flex-shrink-0" /> 
                <span>Live Tracking Hub</span>
              </motion.h1>
              <motion.p 
                className="text-xs sm:text-sm text-gray-500 flex items-center gap-2 mt-0.5"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                <FiActivity className="text-green-500" /> Real-time workforce location intelligence
              </motion.p>
              <motion.p 
                className="text-xs text-gray-400 mt-0.5"
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
              >
                {user?.role === "super_admin" ? "👑 Super Admin" : `🏢 Company: ${user?.companyId}`}
              </motion.p>
            </div>

            {/* Right side - controls wrap on mobile */}
            <motion.div 
              className="flex flex-wrap gap-2 sm:gap-3 items-center w-full sm:w-auto"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {/* Employee Selector */}
              <motion.div variants={fadeInUp} className="relative flex-1 sm:flex-initial min-w-[140px]">
                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:border-blue-400 text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 text-xs">▼</div>
                {isFetchingEmployees && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </motion.div>

              {/* Date Picker */}
              <motion.div variants={fadeInUp} className="relative flex-1 sm:flex-initial">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
              </motion.div>

              {/* Download Button */}
              <motion.button
                variants={fadeInUp}
                onClick={handleDownload}
                disabled={loading}
                className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white font-medium shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 transition-all text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiDownload />
                )}
                {loading ? "Downloading..." : "Export CSV"}
              </motion.button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Content - fills remaining space */}
      <div className="flex-1 w-full px-4 sm:px-6 py-4 sm:py-6">
        {/* Tabs - scrollable on mobile if needed */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-nowrap overflow-x-auto gap-0 border-b border-gray-200 mb-4 pb-0.5 scrollbar-thin"
        >
          <Tab to="live" icon={<FiTarget />}>📍 Live Tracking</Tab>
          <Tab to="timeline" icon={<FiClock />}>🕒 Timeline History</Tab>
          <Tab to="dashboard" icon={<FiBarChart2 />}>📊 Analytics</Tab>
        </motion.div>

        {/* Content Card - takes full width, no overflow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          <div className="p-4 sm:p-5 md:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedEmployee + date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Outlet
                  context={{
                    date,
                    selectedEmployee,
                  }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ================= TAB COMPONENT WITH SMOOTH UNDERLINE ================= */
const Tab = ({ to, children, icon }) => {
  return (
    <NavLink to={to} end>
      {({ isActive }) => (
        <motion.div
          className={`relative px-3 sm:px-5 py-2.5 rounded-t-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 cursor-pointer whitespace-nowrap ${
            isActive 
              ? "text-blue-600" 
              : "text-gray-500 hover:text-gray-800"
          }`}
          whileHover={{ y: -1 }}
          whileTap={{ y: 0 }}
        >
          {icon && <span className="text-sm sm:text-base">{icon}</span>}
          <span>{children}</span>
          {isActive && (
            <motion.div
              layoutId="activeTabUnderline"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </motion.div>
      )}
    </NavLink>
  );
};