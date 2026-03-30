import React, { useEffect, useState } from "react";
import api from "../services/api";

export default function ViewUploadsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employee-data");
      setData(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ DOWNLOAD FUNCTION (IMPROVED)
  const handleDownload = async (id, fileName) => {
    try {
      const res = await api.get(`/employee-data/download/${id}`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;

      // 🔥 Use actual filename
      a.download = fileName || "employee-data.xlsx";

      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Download failed");
    }
  };

  return (
    <div className="p-6 bg-white text-black min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        Uploaded Employee Data
      </h1>

      {loading && <p>Loading...</p>}

      {!loading && data.length === 0 && (
        <p>No uploaded data found.</p>
      )}

      {!loading && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 text-sm">
            
            {/* ================= HEADER ================= */}
            <thead>
              <tr className="bg-gray-200">
                <th className="p-2 border">Employee ID</th>
                <th className="p-2 border">Employee Name</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">Uploaded By</th>
                <th className="p-2 border">Uploaded At</th>
                <th className="p-2 border">Download</th>
              </tr>
            </thead>

            {/* ================= BODY ================= */}
            <tbody>
              {data.map((item) => (
                <tr key={item._id} className="hover:bg-gray-100">

                  {/* Employee ID */}
                  <td className="p-2 border">
                    {item.employeeId}
                  </td>

                  {/* Employee Name (DATA OWNER) */}
                  <td className="p-2 border">
                    {item.user?.name || "N/A"}
                  </td>

                  {/* Category */}
                  <td className="p-2 border">
                    {item.category}
                  </td>

                  {/* Uploaded By (FIXED) */}
                  <td className="p-2 border">
                    {item.uploadedBy?.name || "N/A"}
                  </td>

                  {/* Uploaded Time */}
                  <td className="p-2 border">
                    {new Date(item.uploadedAt).toLocaleString()}
                  </td>

                  {/* Download */}
                  <td className="p-2 border">
                    <button
                      onClick={() =>
                        handleDownload(item._id, item.fileName)
                      }
                      className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-white text-xs"
                    >
                      Download
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}