/**
 * Database Seeder
 * Populates MongoDB with sample admin, employees, geofences, and attendance records
 * Run: node utils/seeder.js
 */

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Geofence = require('../models/Geofence');
const Attendance = require('../models/Attendance');
const LocationLog = require('../models/LocationLog');
const Alert = require('../models/Alert');

const connectDB = async () => { 
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geotrack');
  console.log('✅ Connected to MongoDB');
};

const seed = async () => {
  await connectDB();

  // Clear existing data
  await Promise.all([
    
    User.deleteMany({}),
    Geofence.deleteMany({}),
    Attendance.deleteMany({}),
    LocationLog.deleteMany({}),
    Alert.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // ─── Create Admin ─────────────────────────────────────────────────────────
 const admin = await User.create({
  name: process.env.ADMIN_NAME,
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  role: 'admin',
});
  console.log('👑 Admin created: admin@geotrack.com / Admin@123');

  // ─── Create Geofences ─────────────────────────────────────────────────────
  const geofences = await Geofence.insertMany([
    {
      name: 'HQ Office',
      description: 'Main company headquarters',
      center: { lat: 28.6139, lng: 77.2090 }, // New Delhi
      radius: 300,
      address: 'Connaught Place, New Delhi',
      color: '#3B82F6',
      createdBy: admin._id,
    },
    {
      name: 'Branch Office - Mumbai',
      description: 'Mumbai branch office',
      center: { lat: 19.0760, lng: 72.8777 }, // Mumbai
      radius: 250,
      address: 'Bandra Kurla Complex, Mumbai',
      color: '#10B981',
      createdBy: admin._id,
    },
    {
      name: 'Warehouse - Pune',
      description: 'Pune logistics warehouse',
      center: { lat: 18.5204, lng: 73.8567 }, // Pune
      radius: 500,
      address: 'Hinjewadi, Pune',
      color: '#F59E0B',
      createdBy: admin._id,
    },
  ]);
  console.log(`📍 ${geofences.length} Geofences created`);

  // ─── Create Employees ─────────────────────────────────────────────────────
  const employeeData = [
    { name: 'Rahul Sharma', email: 'rahul@geotrack.com', department: 'Engineering', assignedGeofence: geofences[0]._id },
    { name: 'Priya Patel', email: 'priya@geotrack.com', department: 'Marketing', assignedGeofence: geofences[0]._id },
    { name: 'Amit Singh', email: 'amit@geotrack.com', department: 'Sales', assignedGeofence: geofences[1]._id },
    { name: 'Sneha Reddy', email: 'sneha@geotrack.com', department: 'HR', assignedGeofence: geofences[0]._id },
    { name: 'Vikram Gupta', email: 'vikram@geotrack.com', department: 'Operations', assignedGeofence: geofences[2]._id },
    { name: 'Ananya Iyer', email: 'ananya@geotrack.com', department: 'Engineering', assignedGeofence: geofences[0]._id },
    { name: 'Karan Mehta', email: 'karan@geotrack.com', department: 'Sales', assignedGeofence: geofences[1]._id },
  ];

 const employees = await Promise.all(
  employeeData.map((e, index) =>
    User.create({
      ...e,
      employeeId: `EMP${(index + 1).toString().padStart(4, '0')}`, // ✅ FIX
      password: 'Emp@123',
      role: 'employee',
      phone: '+91-9876543210',
    })
  )
);
  console.log(`👥 ${employees.length} Employees created (password: Emp@123)`);

  // ─── Create Attendance for last 7 days ───────────────────────────────────
  const attendanceRecords = [];
  for (let day = 6; day >= 0; day--) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    const dateStr = date.toISOString().split('T')[0];

    // Randomly skip 1-2 employees per day
    const presentEmployees = employees.filter((_, i) => Math.random() > 0.15);

    for (const emp of presentEmployees) {
      const geo = geofences.find(g => g._id.toString() === emp.assignedGeofence.toString());
      const clockInHour = 8 + Math.floor(Math.random() * 2); // 8-10 AM
      const clockInMin = Math.floor(Math.random() * 60);
      const totalHours = 7 + Math.random() * 2; // 7-9 hours

      const clockInTime = new Date(date);
      clockInTime.setHours(clockInHour, clockInMin, 0);
      const clockOutTime = new Date(clockInTime.getTime() + totalHours * 3600000);

      attendanceRecords.push({
        employee: emp._id,
        date: dateStr,
        clockIn: {
          timestamp: clockInTime,
          location: {
            lat: geo.center.lat + (Math.random() - 0.5) * 0.001,
            lng: geo.center.lng + (Math.random() - 0.5) * 0.001,
            address: geo.address,
          },
          isWithinGeofence: true,
        },
        clockOut: {
          timestamp: clockOutTime,
          location: {
            lat: geo.center.lat + (Math.random() - 0.5) * 0.001,
            lng: geo.center.lng + (Math.random() - 0.5) * 0.001,
            address: geo.address,
          },
          isWithinGeofence: true,
        },
        totalHours: parseFloat(totalHours.toFixed(2)),
        status: clockInHour >= 9 && clockInMin > 30 ? 'late' : 'present',
        geofence: geo._id,
      });
    }
  }

  await Attendance.insertMany(attendanceRecords);
  console.log(`📋 ${attendanceRecords.length} Attendance records created`);

  // ─── Create Sample Alerts ─────────────────────────────────────────────────
  await Alert.insertMany([
    {
      employee: employees[2]._id,
      type: 'geofence_exit',
      message: `${employees[2].name} has left the assigned work area (HQ Office)`,
      location: { lat: 28.6200, lng: 77.2150 },
      geofence: geofences[0]._id,
      severity: 'high',
      isRead: false,
      timestamp: new Date(Date.now() - 2 * 3600000),
    },
    {
      employee: employees[4]._id,
      type: 'late_clockin',
      message: `${employees[4].name} clocked in late at 10:45 AM`,
      severity: 'medium',
      isRead: false,
      timestamp: new Date(Date.now() - 5 * 3600000),
    },
    {
      employee: employees[0]._id,
      type: 'geofence_exit',
      message: `${employees[0].name} left the geofence boundary`,
      severity: 'high',
      isRead: true,
      timestamp: new Date(Date.now() - 24 * 3600000),
    },
  ]);
  console.log('🚨 Sample alerts created');

  console.log('\n✅ Seeding complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Admin:    admin@geotrack.com / Admin@123');
  console.log('Employee: rahul@geotrack.com / Emp@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
