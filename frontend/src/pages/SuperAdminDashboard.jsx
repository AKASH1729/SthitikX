/**
 * Super Admin Dashboard — WITH COUNTDOWN 🚀
 */

import React, { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_API_URL}/super-admin`;

/* ================= HELPER ================= */
const getDaysLeft = (date) => {
  if (!date) return "-";

  const now = new Date();
  const end = new Date(date);

  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

  if (diff <= 0) return "Expired";
  return `${diff} days`;
};

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [fetching, setFetching] = useState(false);

  const token = localStorage.getItem("token");

  /* ================= FETCH ================= */
  const fetchCompanies = async () => {
    try {
      setFetching(true);

      const res = await axios.get(`${API}/companies`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCompanies(res.data.companies || []);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  /* ================= STATS ================= */
  const total = companies.length;
  const free = companies.filter(c => c.plan === "trial").length;
  const paid = companies.filter(c => c.plan !== "trial").length;

  /* ================= GRAPH ================= */
  const planStats = [
    { label: "Free", value: free, color: "bg-yellow-400" },
    { label: "Paid", value: paid, color: "bg-green-500" },
  ];

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-6">

      <h1 className="text-2xl font-bold">🚀 Super Admin Dashboard</h1>

      {/* STATS */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Total Companies" value={total} />
        <Card title="Free Trial" value={free} />
        <Card title="Paid Companies" value={paid} />
      </div>

      {/* GRAPH */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="font-semibold mb-4">📊 Plan Distribution</h2>

        <div className="space-y-3">
          {planStats.map((p, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span>{p.label}</span>
                <span>{p.value}</span>
              </div>

              <div className="w-full bg-gray-200 h-3 rounded">
                <div
                  className={`${p.color} h-3 rounded`}
                  style={{
                    width: `${(p.value / total) * 100 || 0}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white p-5 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">All Companies</h2>

        {fetching ? (
          <p>Loading...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 border-b">
              <tr>
                <th className="py-2 text-left">Company</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
                <th>⏳ Days Left</th> {/* 🔥 NEW */}
              </tr>
            </thead>

            <tbody>
              {companies.map((c) => {
                const expiry =
                  c.plan === "trial"
                    ? c.trialExpiresAt
                    : c.subscriptionExpiresAt;

                return (
                  <tr key={c._id} className="border-b hover:bg-gray-50">

                    <td className="py-3 font-medium">{c.name}</td>
                    <td>{c.email}</td>

                    {/* PLAN */}
                    <td>
                      <span className={`px-2 py-1 text-xs rounded ${
                        c.plan === "trial"
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-green-100 text-green-600"
                      }`}>
                        {c.plan === "trial" ? "Free" : "Paid"}
                      </span>
                    </td>

                    {/* STATUS */}
                    <td>
                      <span className={`px-2 py-1 text-xs rounded ${
                        c.isActive
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* 🔥 COUNTDOWN */}
                    <td>
                      <span className={`text-xs px-2 py-1 rounded ${
                        getDaysLeft(expiry) === "Expired"
                          ? "bg-red-100 text-red-600"
                          : "bg-blue-100 text-blue-600"
                      }`}>
                        {getDaysLeft(expiry)}
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

/* ================= COMPONENT ================= */

const Card = ({ title, value }) => (
  <div className="bg-white p-4 rounded-xl shadow">
    <p className="text-gray-500 text-sm">{title}</p>
    <h2 className="text-xl font-bold">{value}</h2>
  </div>
);