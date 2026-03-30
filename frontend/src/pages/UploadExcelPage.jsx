import React, { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function UploadExcelPage() {
  const { user } = useAuth();

  const [file, setFile] = useState(null);
  const [category, setCategory] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ==============================
  // ✅ FETCH EMPLOYEES (ADMIN)
  // ==============================
  useEffect(() => {
    if (user?.role === "admin") {
      const fetchEmployees = async () => {
        try {
          const res = await api.get("/users");

          let employeeList = [];

          if (Array.isArray(res.data)) {
            employeeList = res.data;
          } else if (Array.isArray(res.data.data)) {
            employeeList = res.data.data;
          } else if (Array.isArray(res.data.users)) {
            employeeList = res.data.users;
          }

          setUsers(employeeList);
        } catch (err) {
          console.error("Fetch employees error:", err);
          setUsers([]);
        }
      };

      fetchEmployees();
    }
  }, [user]);

  // ==============================
  // ✅ UPLOAD FUNCTION
  // ==============================
  const handleUpload = async () => {
    // 🔥 FIX: Strict validation
    if (!file) return setMessage("❌ Please select a file");
    if (!category) return setMessage("❌ Please select category");

    if (user?.role === "admin" && !selectedUser) {
      return setMessage("❌ Please select an employee");
    }

    const userId =
      user?.role === "admin" ? selectedUser : user?._id;

    try {
      setLoading(true);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("userId", userId); // 🔥 ALWAYS SENT

      const res = await api.post("/upload-excel", formData);

      setMessage(
        `✅ Upload successful (${res.data.count || 0} records)`
      );

      // ✅ Reset form
      setFile(null);
      setCategory("");
      setSelectedUser("");

    } catch (err) {
      console.error(err.response?.data || err);
      setMessage(
        err.response?.data?.message || "❌ Upload failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white text-black min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        Upload Employee Data
      </h1>

      {/* ================= EMPLOYEE ================= */}
      <div className="mb-4">
        <label className="block font-semibold mb-2">
          Employee
        </label>

        {user?.role === "admin" ? (
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="p-2 border rounded w-full"
          >
            <option value="">Select Employee</option>

            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.employeeId})
              </option>
            ))}
          </select>
        ) : (
          <div className="p-2 border rounded bg-gray-100">
            {user?.name} ({user?.email})
          </div>
        )}
      </div>

      {/* ================= FILE ================= */}
      <div className="mb-4">
        <label className="block font-semibold mb-2">
          Excel File
        </label>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => setFile(e.target.files[0])}
          className="border p-2 w-full rounded"
        />
      </div>

      {/* ================= CATEGORY ================= */}
      <div className="mb-4">
        <label className="block font-semibold mb-2">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">Select Category</option>
          <option value="flow">Flow</option>
          <option value="current">Current</option>
        </select>
      </div>

      {/* ================= BUTTON ================= */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Upload Excel"}
      </button>

      {/* ================= MESSAGE ================= */}
      {message && (
        <p className="mt-4 text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
}