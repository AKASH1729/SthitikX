import React, { useState } from 'react';
import api from '../services/api';

export default function Dashboard() {
  const [status, setStatus] = useState("Not Checked In");

  // ✅ Clock In
  const handleClockIn = async () => {
    try {
      await api.post("/attendance/clock-in", {
        lat: 0,
        lng: 0,
      });

      setStatus("Checked In ✅");
      alert("Clock In Successful");
    } catch (err) {
      console.error(err);
      alert("Clock In Failed");
    }
  };

  // ✅ Clock Out
  const handleClockOut = async () => {
    try {
      await api.post("/attendance/clock-out");

      setStatus("Checked Out ❌");
      alert("Clock Out Successful");
    } catch (err) {
      console.error(err);
      alert("Clock Out Failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">

      {/* Header */}
      <h1 className="text-2xl font-bold mb-4">Employee Dashboard</h1>

      {/* Status */}
      <p className="mb-6 text-gray-300">
        Status: <span className="font-semibold">{status}</span>
      </p>

      {/* Buttons */}
      <div className="flex gap-4">

        <button
          onClick={handleClockIn}
          className="bg-green-500 px-6 py-3 rounded-lg text-white font-semibold"
        >
          Clock In
        </button>

        <button
          onClick={handleClockOut}
          className="bg-red-500 px-6 py-3 rounded-lg text-white font-semibold"
        >
          Clock Out
        </button>

      </div>

    </div>
  );
}