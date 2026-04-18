import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { FiUploadCloud, FiUser, FiFileText, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { FaSpinner } from "react-icons/fa";

export default function UploadExcelPage() {
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [category, setCategory] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Role protection
  if (user?.role === "employee" && !user?._id) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Restricted</h2>
          <p className="text-gray-600">
            You don't have permission to view this page. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Fetch employees
  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/v2/users?limit=100");
      const employeeList = res.data?.users || res.data?.data || res.data || [];
      setUsers(employeeList);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load employees");
      setUsers([]);
    }
  };

  // File validation
  const handleFileChange = (e) => {
    const f = e.target.files[0];

    if (!f) return;

    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("Only Excel files (.xlsx, .xls) are allowed");
      return;
    }

    if (f.size > 5 * 1024 * 1024) {
      setError("File size exceeds the maximum limit of 5MB");
      return;
    }

    setError("");
    setFile(f);
  };

  // File upload handler
  const handleUpload = async () => {
    if (!file) return setError("Please select a file to upload");
    if (!category) return setError("Please select a category");

    if ((user?.role === "admin" || user?.role === "super_admin") && !selectedUser)
      return setError("Please select an employee");

    const userId =
      user?.role === "admin" || user?.role === "super_admin"
        ? selectedUser
        : user?._id;

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("userId", userId);

      const res = await api.post("/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage(`✅ Successfully uploaded ${res.data.count || 0} records`);
      setFile(null);
      setCategory("");
      setSelectedUser("");

    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FiUploadCloud className="text-blue-600" />
            Upload Employee Data
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.role === "super_admin"
              ? "Super Admin Dashboard"
              : `Company: ${user?.companyId}`}
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
            <FiAlertCircle className="text-red-500 text-lg flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded flex items-start gap-3">
            <FiCheckCircle className="text-green-500 text-lg flex-shrink-0" />
            <p className="text-green-700 text-sm">{message}</p>
          </div>
        )}

        {/* Employee Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <FiUser size={14} /> Employee
          </label>
          {(user?.role === "admin" || user?.role === "super_admin") ? (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            >
              <option value="">Select Employee</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.employeeId || "No ID"})
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
              <p className="text-gray-700">{user?.name}</p>
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <FiFileText size={14} /> Excel File
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 transition-colors hover:border-blue-500">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
            />
            <label
              htmlFor="fileInput"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <FiUploadCloud className="text-gray-400 text-3xl" />
              <p className="text-sm text-gray-600">
                {file ? file.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-gray-500">Supports .xlsx, .xls (Max 5MB)</p>
            </label>
          </div>
        </div>

        {/* Category Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <input
            list="category-options"
            placeholder="Enter or select category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          />
          <datalist id="category-options">
            <option value="flow" />
            <option value="current" />
            <option value="salary" />
            <option value="report" />
          </datalist>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${
            loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <FaSpinner className="animate-spin" />
              <span>Uploading...</span>
            </div>
          ) : (
            "Upload File"
          )}
        </button>
      </div>
    </div>
  );
}