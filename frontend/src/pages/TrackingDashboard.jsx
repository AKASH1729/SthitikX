import React, { useEffect, useState } from "react";
import api from "../services/api";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= FETCH ================= */
  useEffect(() => {
    if (!date) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await api.get(`/dashboards?date=${date}`);
        setData(res.data);

      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [date]);

  return (
    <div className="p-6">

      {/* 🔥 TOP BAR */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Dashboard</h2>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border px-3 py-2 rounded"
        />
      </div>

      {/* 🔥 LOADING */}
      {loading && <p>Loading...</p>}

      {/* 🔥 EMPTY */}
      {!date && <p>Select a date to view dashboard</p>}

      {/* 🔥 MAIN */}
      {data && !loading && (
        <>
          {/* CARDS */}
          <div className="grid grid-cols-4 gap-4 mb-6">

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
          <div className="bg-white shadow rounded p-4">

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

          </div>
        </>
      )}
    </div>
  );
}

/* 🔥 CARD COMPONENT */
const Card = ({ title, value, color }) => (
  <div className={`${color} p-4 rounded shadow`}>
    <p className="text-sm text-gray-600">{title}</p>
    <h3 className="text-xl font-bold mt-1">{value}</h3>
  </div>
);