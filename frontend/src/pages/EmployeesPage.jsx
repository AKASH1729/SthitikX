/**
 * EmployeesPage — Zone-based Layout · Premium UI
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiEdit, FiTrash2, FiSearch, FiPlus, FiUser,
  FiPhone, FiMail, FiMapPin, FiX, FiChevronDown,
  FiChevronUp, FiAlertCircle
} from "react-icons/fi";
import { FaUserCheck, FaUserSlash } from "react-icons/fa";

/* ─────────────────────────────────────────────
   ZONE COLOR PALETTE — distinct per zone index
───────────────────────────────────────────── */
const ZONE_PALETTES = [
  { bg: "from-violet-500 to-purple-600", light: "bg-violet-50", border: "border-violet-200", text: "text-violet-700", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700" },
  { bg: "from-sky-500 to-blue-600",      light: "bg-sky-50",    border: "border-sky-200",    text: "text-sky-700",    dot: "bg-sky-500",    badge: "bg-sky-100 text-sky-700"    },
  { bg: "from-emerald-500 to-green-600", light: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-700",dot: "bg-emerald-500",badge: "bg-emerald-100 text-emerald-700"},
  { bg: "from-amber-500 to-orange-500",  light: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-700"  },
  { bg: "from-rose-500 to-red-600",      light: "bg-rose-50",   border: "border-rose-200",   text: "text-rose-700",   dot: "bg-rose-500",   badge: "bg-rose-100 text-rose-700"   },
  { bg: "from-cyan-500 to-teal-600",     light: "bg-cyan-50",   border: "border-cyan-200",   text: "text-cyan-700",   dot: "bg-cyan-500",   badge: "bg-cyan-100 text-cyan-700"   },
  { bg: "from-pink-500 to-fuchsia-600",  light: "bg-pink-50",   border: "border-pink-200",   text: "text-pink-700",   dot: "bg-pink-500",   badge: "bg-pink-100 text-pink-700"   },
];
const NO_ZONE_PALETTE = {
  bg: "from-gray-400 to-gray-500", light: "bg-gray-50", border: "border-gray-200",
  text: "text-gray-600", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600"
};

const getInitials = (name = "") =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

/* ═══════════════════════════════════════════
   EMPLOYEE CARD
═══════════════════════════════════════════ */
const EmployeeCard = ({ emp, palette, onEdit, onDelete, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04, duration: 0.25 }}
    className={`group relative bg-white rounded-2xl border ${palette.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}
  >
    {/* Status stripe */}
    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${emp.isActive ? palette.dot : "bg-gray-300"}`} />

    <div className="pl-4 pr-3 py-4 flex items-center gap-3">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${palette.bg} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
          {getInitials(emp.name)}
        </div>
        {/* Online dot */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${emp.isTracking ? "bg-green-500" : "bg-gray-300"}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-gray-900 text-sm truncate">{emp.name}</span>
          {emp.isActive
            ? <FaUserCheck className="text-green-500 flex-shrink-0" size={12} />
            : <FaUserSlash className="text-gray-400 flex-shrink-0" size={12} />
          }
        </div>
        <div className="text-xs text-gray-400 truncate">
          {emp.email}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {emp.department && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${palette.badge}`}>
              {emp.department}
            </span>
          )}
          {emp.employeeId && (
            <span className="text-xs text-gray-400">#{emp.employeeId}</span>
          )}
          {emp.phone && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <FiPhone size={10} /> {emp.phone}
            </span>
          )}
        </div>
      </div>

      {/* Actions — appear on hover */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(emp)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Edit"
        >
          <FiEdit size={14} />
        </button>
        <button
          onClick={() => onDelete(emp._id)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          <FiTrash2 size={14} />
        </button>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════
   ZONE SECTION
═══════════════════════════════════════════ */
const ZoneSection = ({ zone, palette, employees, onEdit, onDelete, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const active = employees.filter((e) => e.isActive).length;
  const tracking = employees.filter((e) => e.isTracking).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${palette.border} overflow-hidden shadow-sm`}
    >
      {/* Zone Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-4 ${palette.light} hover:brightness-95 transition-all`}
      >
        <div className="flex items-center gap-3">
          {/* Zone icon */}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${palette.bg} flex items-center justify-center shadow-sm`}>
            <FiMapPin className="text-white" size={16} />
          </div>
          <div className="text-left">
            <div className={`font-bold text-base ${palette.text}`}>{zone.name}</div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span>{employees.length} employee{employees.length !== 1 ? "s" : ""}</span>
              {active > 0 && <span className="text-green-600">· {active} active</span>}
              {tracking > 0 && (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  {tracking} live
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${palette.badge}`}>
            {employees.length}
          </span>
          {open ? <FiChevronUp className={palette.text} /> : <FiChevronDown className="text-gray-400" />}
        </div>
      </button>

      {/* Employees Grid */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white">
              {employees.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FiUser size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No employees in this zone</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {employees.map((emp, i) => (
                    <EmployeeCard
                      key={emp._id}
                      emp={emp}
                      palette={palette}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      index={i}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   MODAL
═══════════════════════════════════════════ */
function EmployeeModal({ employee, geofences, onClose, onSave }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    password: "",
    department: employee?.department || "",
    phone: employee?.phone || "",
    assignedGeofence: employee?.assignedGeofence?._id || "",
    isActive: employee?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.name.trim() || !form.email.trim()) throw new Error("Name and Email are required");
      if (!isEdit && !form.password) throw new Error("Password is required for new employees");
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department,
        phone: form.phone,
        isActive: form.isActive,
        assignedGeofence: form.assignedGeofence || undefined,
      };
      if (form.password) payload.password = form.password;
      await api[isEdit ? "put" : "post"](`/v2/users${isEdit ? `/${employee._id}` : ""}`, payload);
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ label, icon: Icon, children, className = "" }) => (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon size={11} />} {label}
      </label>
      {children}
    </div>
  );

  const inputCls = "w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 bg-gray-50 focus:bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:outline-none transition-all placeholder:text-gray-300";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? "Edit Employee" : "Add New Employee"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? `Editing ${employee.name}` : "Fill in the details below"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <FiX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm"
              >
                <FiAlertCircle className="flex-shrink-0 mt-0.5" size={15} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <InputField label="Full Name" icon={FiUser}>
            <input className={inputCls} placeholder="Jane Smith" value={form.name} onChange={set("name")} required />
          </InputField>

          <InputField label="Email Address" icon={FiMail}>
            <input className={inputCls} placeholder="jane@company.com" type="email" value={form.email} disabled={isEdit} onChange={set("email")} required />
          </InputField>

          {!isEdit && (
            <InputField label="Password">
              <input className={inputCls} placeholder="Min. 8 characters" type="password" onChange={set("password")} required />
            </InputField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Department">
              <input className={inputCls} placeholder="Sales, IT, etc." value={form.department} onChange={set("department")} />
            </InputField>
            <InputField label="Phone" icon={FiPhone}>
              <input className={inputCls} placeholder="+91 99999 00000" value={form.phone} onChange={set("phone")} />
            </InputField>
          </div>

          <InputField label="Assigned Zone" icon={FiMapPin}>
            <select className={inputCls} value={form.assignedGeofence} onChange={set("assignedGeofence")}>
              <option value="">No Zone Assigned</option>
              {geofences.map((g) => (
                <option key={g._id} value={g._id}>{g.name}</option>
              ))}
            </select>
          </InputField>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Account Status</div>
              <div className="text-xs text-gray-400">{form.isActive ? "Employee can log in" : "Login is disabled"}</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${form.isActive ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 text-sm py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 text-sm py-2.5 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
              ) : (
                <>{isEdit ? "Update" : "Add"} Employee</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════ */
export default function EmployeesPage() {
  const { user } = useAuth();

  if (user?.role === "employee") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-10">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Access Restricted</h2>
          <p className="text-gray-500 text-sm">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const [employees, setEmployees] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("zone"); // "zone" | "all"

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [empRes, geoRes] = await Promise.all([
        api.get("/v2/users", { params: { search, limit: 200 } }),
        api.get("/geofences/all"),
      ]);
      setEmployees(empRes.data?.users || []);
      setGeofences(geoRes.data?.geofences || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchData, 400);
    return () => clearTimeout(t);
  }, [fetchData]);

  const deleteEmployee = async (id) => {
    if (!window.confirm("Delete this employee? This action cannot be undone.")) return;
    try {
      await api.delete(`/v2/users/${id}`);
      fetchData();
    } catch {
      setError("Failed to delete employee.");
    }
  };

  /* Build zone groups */
  const zoneGroups = geofences.map((zone, idx) => ({
    zone,
    palette: ZONE_PALETTES[idx % ZONE_PALETTES.length],
    employees: employees.filter((emp) => emp.assignedGeofence?._id === zone._id),
  })).filter((g) => g.employees.length > 0 || viewMode === "zone");

  const noZoneEmps = employees.filter((emp) => !emp.assignedGeofence);

  /* Stats */
  const totalActive = employees.filter((e) => e.isActive).length;
  const totalTracking = employees.filter((e) => e.isTracking).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── STICKY TOP BAR ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title + stats */}
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Employee Management</h1>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{employees.length} total</span>
                  <span className="text-green-600 font-medium">{totalActive} active</span>
                  {totalTracking > 0 && (
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                      {totalTracking} live
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="text-sm pl-9 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-gray-400 focus:ring-2 focus:ring-gray-100 focus:outline-none transition-all w-48 sm:w-56"
                />
              </div>

              {/* View toggle */}
              <div className="flex bg-gray-100 rounded-xl p-0.5 text-xs font-medium">
                {[["zone", "By Zone"], ["all", "All"]].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setViewMode(v)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${viewMode === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Add button */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setModal("add")}
                className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2 rounded-xl font-medium hover:bg-gray-800 transition-colors"
              >
                <FiPlus size={15} />
                <span className="hidden sm:inline">Add Employee</span>
                <span className="sm:hidden">Add</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
            >
              <span className="flex items-center gap-2"><FiAlertCircle /> {error}</span>
              <button onClick={fetchData} className="font-semibold hover:underline ml-4">Retry</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-2 border-t-gray-800 animate-spin" />
            </div>
            <span className="text-sm text-gray-400">Loading employees...</span>
          </div>
        ) : viewMode === "zone" ? (
          /* ── ZONE VIEW ── */
          <div className="space-y-4">
            {zoneGroups.map(({ zone, palette, employees: emps }, idx) => (
              <ZoneSection
                key={zone._id}
                zone={zone}
                palette={palette}
                employees={emps}
                onEdit={setModal}
                onDelete={deleteEmployee}
                defaultOpen={idx === 0}
              />
            ))}

            {/* No Zone section */}
            {noZoneEmps.length > 0 && (
              <ZoneSection
                zone={{ _id: "no-zone", name: "Unassigned" }}
                palette={NO_ZONE_PALETTE}
                employees={noZoneEmps}
                onEdit={setModal}
                onDelete={deleteEmployee}
                defaultOpen={false}
              />
            )}

            {employees.length === 0 && !loading && (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">👥</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-1">No employees found</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {search ? `No results for "${search}"` : "Start by adding your first employee."}
                </p>
                {!search && (
                  <button onClick={() => setModal("add")} className="text-sm bg-gray-900 text-white px-5 py-2.5 rounded-xl font-medium">
                    Add Employee
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── ALL VIEW (flat grid) ── */
          <div>
            {employees.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-3">👥</div>
                <p className="text-sm text-gray-400">No employees found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {employees.map((emp, i) => {
                  const zoneIdx = geofences.findIndex((g) => g._id === emp.assignedGeofence?._id);
                  const palette = zoneIdx >= 0 ? ZONE_PALETTES[zoneIdx % ZONE_PALETTES.length] : NO_ZONE_PALETTE;
                  return (
                    <EmployeeCard
                      key={emp._id}
                      emp={emp}
                      palette={palette}
                      onEdit={setModal}
                      onDelete={deleteEmployee}
                      index={i}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {modal && (
          <EmployeeModal
            employee={modal === "add" ? null : modal}
            geofences={geofences}
            onClose={() => setModal(null)}
            onSave={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
