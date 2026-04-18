/**
 * EmployeesPage — Full Width Optimized UX Version 🚀
 */

import React, { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import LoadingSpinner from "../components/Shared/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { FiEdit, FiTrash2, FiSearch, FiPlus, FiUser, FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import { FaUserCheck, FaUserSlash } from "react-icons/fa";

/* =========================
   MODAL - Optimized UX
========================= */
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!form.name.trim() || !form.email.trim()) {
        throw new Error("Name and Email are required");
      }

      if (!isEdit && !form.password) {
        throw new Error("Password is required");
      }

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department,
        phone: form.phone,
        isActive: form.isActive,
        assignedGeofence: form.assignedGeofence || undefined,
      };

      if (form.password) payload.password = form.password;

      await api[isEdit ? "put" : "post"](`/v2/users${isEdit ? `/${employee._id}` : ''}`, payload);
      onSave();
      
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 p-4">
      <div 
        className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-600 text-white p-4">
          <h3 className="font-bold text-lg">
            {isEdit ? "Edit Employee" : "Add New Employee"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm text-gray-600 flex items-center gap-1">
              <FiUser size={14} /> Full Name
            </label>
            <input
              className="input w-full"
              placeholder="John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-600 flex items-center gap-1">
              <FiMail size={14} /> Email
            </label>
            <input
              className="input w-full"
              placeholder="john@company.com"
              type="email"
              value={form.email}
              disabled={isEdit}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-1">
              <label className="text-sm text-gray-600">Password</label>
              <input
                className="input w-full"
                placeholder="••••••••"
                type="password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-gray-600">Department</label>
              <input
                className="input w-full"
                placeholder="Sales, Marketing, etc."
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-600 flex items-center gap-1">
                <FiPhone size={14} /> Phone
              </label>
              <input
                className="input w-full"
                placeholder="+1 (555) 123-4567"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-gray-600 flex items-center gap-1">
              <FiMapPin size={14} /> Assigned Zone
            </label>
            <select
              className="input w-full"
              value={form.assignedGeofence}
              onChange={(e) => setForm({ ...form, assignedGeofence: e.target.value })}
            >
              <option value="">No Zone Assigned</option>
              {geofences.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <div className={`w-10 h-4 rounded-full shadow-inner transition-colors ${form.isActive ? 'bg-blue-500' : 'bg-gray-300'}`}>
                  <div className={`absolute w-5 h-5 rounded-full shadow-md transition-transform ${form.isActive ? 'translate-x-6 bg-blue-600' : 'translate-x-0 bg-gray-400'} -top-0.5 -left-0.5`}></div>
                </div>
              </div>
              <span className="text-sm text-gray-600">
                {form.isActive ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 flex items-center gap-1"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin">↻</span>
                  Saving...
                </>
              ) : (
                <>
                  {isEdit ? "Update" : "Add"} Employee
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   MAIN PAGE - Full Width
========================= */
export default function EmployeesPage() {
  const { user } = useAuth();

  if (user?.role === "employee") {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Restricted</h2>
          <p className="text-gray-600">
            You don't have permission to view this page. Please contact your administrator.
          </p>
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [empRes, geoRes] = await Promise.all([
        api.get("/v2/users", { params: { search, limit: 50 } }),
        api.get("/geofences/all"),
      ]);

      setEmployees(empRes.data?.users || []);
      setGeofences(geoRes.data?.geofences || []);

    } catch (err) {
      setError(err.response?.data?.message || "Failed to load employees. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 500);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const deleteEmployee = async (id) => {
    if (!window.confirm("Are you sure you want to delete this employee?")) return;

    try {
      await api.delete(`/v2/users/${id}`);
      fetchData();
    } catch {
      setError("Failed to delete employee. Please try again.");
    }
  };

  const groupedZones = geofences.map((zone) => ({
    ...zone,
    employees: employees.filter((emp) => emp.assignedGeofence?._id === zone._id),
  }));

  const noZone = employees.filter((emp) => !emp.assignedGeofence);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchData} 
            className="btn-primary px-4 py-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      {/* HEADER - Full Width */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employee Management</h1>
          <p className="text-gray-600 text-sm">
            {employees.length} {employees.length === 1 ? 'employee' : 'employees'} found
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
            <input
              className="input pl-9 w-full"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <button
            onClick={() => setModal("add")}
            className="btn-primary flex items-center gap-1 whitespace-nowrap"
          >
            <FiPlus size={16} />
            Add Employee
          </button>
        </div>
      </div>

      {/* CONTENT - Full Width Table Layout */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {groupedZones.concat([{ _id: 'no-zone', name: 'No Zone Assigned', employees: noZone }]).map((zone) => (
          <div key={zone._id} className="border-b border-gray-200 last:border-b-0">
            <div className={`p-3 flex justify-between items-center ${zone._id === 'no-zone' ? 'bg-gray-50' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-2">
                <FiMapPin className={zone._id === 'no-zone' ? 'text-gray-500' : 'text-blue-500'} />
                <h3 className="font-medium">
                  {zone.name} <span className="text-gray-500">({zone.employees.length})</span>
                </h3>
              </div>
            </div>

            {zone.employees.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {zone.employees.map((emp) => (
                  <div key={emp._id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <FiUser size={18} />
                          </div>
                          {emp.isTracking ? (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                          ) : (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {emp.name}
                            {emp.isActive ? (
                              <FaUserCheck className="text-green-500 text-sm" />
                            ) : (
                              <FaUserSlash className="text-gray-400 text-sm" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {emp.department || 'No department'} • {emp.employeeId || 'No ID'}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setModal(emp)}
                          className="text-gray-600 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <FiEdit size={16} />
                        </button>
                        <button
                          onClick={() => deleteEmployee(emp._id)}
                          className="text-gray-600 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No employees in this zone
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL */}
      {modal && (
        <EmployeeModal
          employee={modal === "add" ? null : modal}
          geofences={geofences}
          onClose={() => setModal(null)}
          onSave={fetchData}
        />
      )}
    </div>
  );
}