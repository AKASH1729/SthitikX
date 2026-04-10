require("dotenv").config();
const mongoose = require("mongoose");

const LocationLog = require("./models/LocationLog");
const User = require("./models/User");

const seedData = async () => {
  try {
    // ✅ Connect DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ DB Connected");

    // ✅ Find EMP0005
    const user = await User.findOne({ employeeId: "EMP0005" });

    if (!user) {
      console.log("❌ EMP0005 not found in users collection");
      process.exit(1);
    }

    console.log("👤 Found User:", user._id);

    // ✅ Your Data
    const data = [
      {
        employee: user._id,
        employeeId: "EMP0005",
        location: {
          type: "Point",
          coordinates: [88.3639, 22.5726]
        },
        lat: 22.5726,
        lng: 88.3639,
        speed: 0,
        accuracy: 5,
        heading: 0,
        date: "2026-04-10",
        timestamp: new Date("2026-04-10T09:00:00Z"),
        isInsideGeofence: true
      },
      {
        employee: user._id,
        employeeId: "EMP0005",
        location: {
          type: "Point",
          coordinates: [88.3645, 22.5735]
        },
        lat: 22.5735,
        lng: 88.3645,
        speed: 4,
        accuracy: 5,
        heading: 45,
        date: "2026-04-10",
        timestamp: new Date("2026-04-10T09:05:00Z"),
        isInsideGeofence: true
      },
      {
        employee: user._id,
        employeeId: "EMP0005",
        location: {
          type: "Point",
          coordinates: [88.3665, 22.5755]
        },
        lat: 22.5755,
        lng: 88.3665,
        speed: 20,
        accuracy: 5,
        heading: 90,
        date: "2026-04-10",
        timestamp: new Date("2026-04-10T09:10:00Z"),
        isInsideGeofence: true
      },
      {
        employee: user._id,
        employeeId: "EMP0005",
        location: {
          type: "Point",
          coordinates: [88.3666, 22.5756]
        },
        lat: 22.5756,
        lng: 88.3666,
        speed: 0,
        accuracy: 5,
        heading: 0,
        date: "2026-04-10",
        timestamp: new Date("2026-04-10T09:20:00Z"),
        isInsideGeofence: true
      }
    ];

    // ✅ Clear old data
    await LocationLog.deleteMany({ employeeId: "EMP0005" });

    // ✅ Insert new data
    await LocationLog.insertMany(data);

    console.log("✅ Seed Data Inserted Successfully 🚀");
    process.exit();

  } catch (error) {
    console.error("❌ SEED ERROR:", error);
    process.exit(1);
  }
};

seedData();