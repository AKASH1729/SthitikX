// const User = require("../models/User");

// const createAdmin = async () => {
//   try {
//     const adminExists = await User.findOne({
//       email: process.env.ADMIN_EMAIL,
//     });

//     if (adminExists) {
//       console.log("✅ Admin already exists");
//       return;
//     }

//     await User.create({
//       name: process.env.ADMIN_NAME,
//       email: process.env.ADMIN_EMAIL,
//       password: process.env.ADMIN_PASSWORD,
//       role: "admin",
//     });

//     console.log("👑 Admin created automatically");
//   } catch (error) {
//     console.error("❌ Admin creation failed:", error.message);
//   }
// };

// module.exports = createAdmin;