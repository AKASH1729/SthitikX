import React, { useEffect, useState, useRef } from "react";
import api from "../services/api";
import {
  MapContainer,
  TileLayer,
  Polyline
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function TimelinePage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [date, setDate] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [selectedPath, setSelectedPath] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);

  const mapRef = useRef(null);

  /* ================= FETCH EMPLOYEES ================= */
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get("/users/employees");
        setEmployees(res.data);
      } catch (err) {
        console.error("EMPLOYEE FETCH ERROR:", err);
      }
    };
    fetchEmployees();
  }, []);

  /* ================= FETCH TIMELINE ================= */
  const fetchTimeline = async (empId, d) => {
    if (!empId || !d) return;

    try {
      const res = await api.get(
        `/timeline?employeeId=${empId}&date=${d}`
      );

      setTimeline(res.data);

      // 🔥 FULL ROUTE
      let coords = [];
      res.data.forEach(t => {
        if (t.points) coords.push(...t.points);
      });

      setSelectedPath(coords);
      setActiveIndex(null);

    } catch (err) {
      console.error("TIMELINE ERROR:", err);
    }
  };

  /* ================= HANDLE CHANGE ================= */
  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployee(id);
    fetchTimeline(id, date);
  };

  const handleDateChange = (e) => {
    const d = e.target.value;
    setDate(d);
    fetchTimeline(selectedEmployee, d);
  };

  /* ================= MAP AUTO FIT ================= */
  useEffect(() => {
    if (mapRef.current && selectedPath.length > 0) {
      try {
        mapRef.current.fitBounds(selectedPath, { padding: [50, 50] });
      } catch (err) {
        console.log("FitBounds error:", err);
      }
    }
  }, [selectedPath]);

  return (
    <div className="p-4">

      {/* 🔥 TOP BAR */}
      <div className="flex gap-3 mb-4">

        {/* EMPLOYEE SELECT */}
        <select
          value={selectedEmployee}
          onChange={handleEmployeeChange}
          className="border px-3 py-2 rounded"
        >
          <option value="">Select Employee</option>
          {employees.map(emp => (
            <option key={emp.employeeId} value={emp.employeeId}>
              {emp.name}
            </option>
          ))}
        </select>

        {/* DATE */}
        <input
          type="date"
          value={date}
          onChange={handleDateChange}
          className="border px-3 py-2 rounded"
        />

      </div>

      {/* 🔥 MAIN */}
      <div className="flex gap-4">

        {/* LEFT TIMELINE */}
        <div className="w-80 bg-white p-4 shadow rounded overflow-y-auto h-[500px]">

          <h3 className="font-bold mb-3">Timeline</h3>

          {timeline.length === 0 && (
            <p className="text-sm text-gray-500">No data</p>
          )}

          {timeline.map((item, i) => (
            <div
              key={i}
              onClick={() => {
                setSelectedPath(item.points);
                setActiveIndex(i);
              }}
              className={`mb-3 border-b pb-2 cursor-pointer ${
                activeIndex === i ? "bg-gray-100" : ""
              }`}
            >
              <p className="font-semibold">
                {item.type === "STOP" && "⛔ Stop"}
                {item.type === "WALK" && "🚶 Walk"}
                {item.type === "DRIVE" && "🚗 Drive"}
              </p>

              <p className="text-xs text-gray-500">
                {new Date(item.startTime).toLocaleTimeString()} →
                {new Date(item.endTime).toLocaleTimeString()}
              </p>

              <p className="text-sm">
                {item.distance} km • {item.duration} min
              </p>
            </div>
          ))}

        </div>

        {/* RIGHT MAP */}
        <div className="flex-1">

          <MapContainer
            center={[22.57, 88.36]}
            zoom={14}
            style={{ height: "500px", width: "100%" }}
            whenCreated={(mapInstance) => {
              mapRef.current = mapInstance;
            }}
          >
            {/* 🔥 PAGARGEO STYLE MAP */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* 🔥 DRAW ALL SEGMENTS */}
            {timeline.map((t, i) => (
              <Polyline
                key={i}
                positions={t.points}
                pathOptions={{
                  color:
                    t.type === "STOP"
                      ? "red"
                      : t.type === "WALK"
                      ? "green"
                      : "blue",
                  weight: activeIndex === i ? 6 : 3
                }}
              />
            ))}

          </MapContainer>

        </div>

      </div>
    </div>
  );
}