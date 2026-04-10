import React from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function LiveMapLayout() {
  return (
    <div className="p-4 bg-gray-100 min-h-screen">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Live Map</h1>

        <div className="flex gap-3">
          <input type="date" className="border px-2 py-1 rounded" />
          <button className="bg-blue-600 text-white px-4 py-1 rounded">
            Download
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-6 border-b mb-4">

        <Tab to="live">Live Tracking</Tab>
        <Tab to="timeline">Timeline</Tab>
        <Tab to="dashboard">Dashboard</Tab>
        <Tab to="tasks">Tasks</Tab>
        <Tab to="settings">Settings</Tab>

      </div>

      {/* CONTENT */}
      <div className="bg-white rounded shadow p-4">
        <Outlet />
      </div>
    </div>
  );
}

/* TAB COMPONENT */
const Tab = ({ to, children }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `pb-2 ${
          isActive
            ? "border-b-2 border-green-500 font-semibold text-black"
            : "text-gray-500"
        }`
      }
    >
      {children}
    </NavLink>
  );
};