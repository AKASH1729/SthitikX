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

  // ================= FETCH EMPLOYEES =================
  useEffect(() => {
    if (user?.role === "admin") {
      fetchEmployees();
    }
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/users");

      console.log("EMPLOYEE API:", res.data);

      const employeeList =
        res.data?.users ||
        res.data?.data ||
        res.data ||
        [];

      setUsers(employeeList);
    } catch (err) {
      console.error("Fetch error:", err);
      setUsers([]);
    }
  };

  // ================= UPLOAD =================
  const handleUpload = async () => {
    if (!file) return setMessage("❌ Select file");
    if (!category) return setMessage("❌ Select category");
    if (user?.role === "admin" && !selectedUser)
      return setMessage("❌ Select employee");

    const userId =
      user?.role === "admin" ? selectedUser : user?._id;

    try {
      setLoading(true);
      setMessage("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      formData.append("userId", userId);

      const res = await api.post("/upload-excel", formData);

      setMessage(`✅ Uploaded (${res.data.count || 0})`);

      setFile(null);
      setCategory("");
      setSelectedUser("");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "❌ Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white text-black min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        Upload Employee Data
      </h1>

      {/* EMPLOYEE */}
      <div className="mb-4">
        <label className="block font-semibold mb-2">
          Employee
        </label>

        {user?.role === "admin" ? (
          <>
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

            {users.length === 0 && (
              <p className="text-red-500 mt-2">
                No employees found ⚠️
              </p>
            )}
          </>
        ) : (
          <div className="p-2 border bg-gray-100">
            {user?.name}
          </div>
        )}
      </div>

      {/* FILE */}
      <div className="mb-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files[0])}
          className="border p-2 w-full"
        />
      </div>

      {/* CATEGORY */}
      <div className="mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="p-2 border w-full"
        >
          <option value="">Select Category</option>
          <option value="flow">Flow</option>
          <option value="current">Current</option>
        </select>
      </div>

      {/* BUTTON */}
      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>

      {/* MESSAGE */}
      {message && <p className="mt-3">{message}</p>}
    </div>
  );
}