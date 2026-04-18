/**
 * DashboardPage — FULL FINAL VERSION 🔥
 */

import React, { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {

  const { user } = useAuth();

  /* 🔥 ROLE PROTECTION */
  if (user?.role === "employee") {
    return <p className="text-center mt-20">Access denied</p>;
  }

  const today = new Date().toISOString().split("T")[0];

  const [data, setData] = useState(null);
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ================= FETCH ================= */
  const fetchData = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.get(`/dashboards?date=${date}`);
      setData(res.data);

    } catch (err) {
      console.error("Dashboard error:", err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();

    // 🔥 AUTO REFRESH EVERY 30s
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);

  }, [fetchData]);

  /* ================= DATE ================= */
  const handleDateChange = (value) => {
    if (value > today) {
      alert("Future date not allowed");
      return;
    }
    setDate(value);
  };

  /* ================= STATES ================= */
  if (loading && !data) return <p className="p-6">Loading...</p>;

  if (error) {
    return (
      <div className="text-center mt-20">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchData} className="btn-primary mt-3">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">

        <div>
          <h2 className="text-2xl font-semibold">📊 Dashboard</h2>

          <p className="text-xs text-gray-500">
            {user?.role === "super_admin"
              ? "👑 Super Admin"
              : `Company: ${user?.companyId}`}
          </p>
        </div>

        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => handleDateChange(e.target.value)}
          className="border px-3 py-2 rounded"
        />
      </div>

      {/* EMPTY */}
      {!data && !loading && (
        <p>Select a date to view dashboard</p>
      )}

      {/* MAIN */}
      {data && (
        <>
          {/* CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

            <Card
              title="Total Distance"
              value={`${data.totalDistance} km`}
              color="bg-green-100"
            />

            <Card
              title="Total Time"
              value={`${data.totalTime} mins`}
              color="bg-purple-100"
            />

            <Card
              title="Time in Motion"
              value={`${data.motionTime} mins`}
              color="bg-pink-100"
            />

            <Card
              title="Time at Rest"
              value={`${data.restTime} mins`}
              color="bg-blue-100"
            />

          </div>

          {/* TABLE */}
          <div className="bg-white shadow rounded p-4 overflow-x-auto">

            {data.table.length === 0 ? (
              <p className="text-center text-gray-500 py-6">
                No data available
              </p>
            ) : (
              <table className="w-full text-sm">

                <thead className="text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Name</th>
                    <th>Total Distance</th>
                    <th>Total Time</th>
                    <th>Motion</th>
                    <th>Rest</th>
                  </tr>
                </thead>

                <tbody>
                  {data.table.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2">{row.name}</td>
                      <td>{row.totalDistance} km</td>
                      <td>{row.totalTime}</td>
                      <td>{row.motion}</td>
                      <td>{row.rest}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            )}

          </div>
        </>
      )}

    </div>
  );
}

/* ================= CARD ================= */
const Card = ({ title, value, color }) => (
  <div className={`${color} p-4 rounded shadow`}>
    <p className="text-sm text-gray-600">{title}</p>
    <h3 className="text-xl font-bold mt-1">{value}</h3>
  </div>
);