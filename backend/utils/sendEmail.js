/**
 * Email Service — SthitiX 🚀
 */

const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // 🔥 app password
      },
    });

    await transporter.sendMail({
      from: `"SthitiX" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("📧 Email sent to:", to);

  } catch (err) {
    console.error("EMAIL ERROR:", err);
    throw new Error("Email sending failed");
  }
};

module.exports = sendEmail;