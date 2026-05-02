import React, { useState } from "react";
import api from "../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";

/* ================= LOAD RAZORPAY ================= */
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const plan = searchParams.get("plan") || "trial";

  const planDetails = {
    trial: { name: "Free Trial", price: "₹0" },
    pro: { name: "Starter", price: "₹999" },
    business: { name: "Growth", price: "₹1999" },
    premium: { name: "Scale", price: "₹2999" },
    enterprise: { name: "Custom", price: "₹6999" },
  };

  const currentPlan = planDetails[plan] || planDetails.trial;

  const [form, setForm] = useState({
    companyName: "",
    adminName: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ================= SUBMIT ================= */
const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");

  if (!form.companyName || !form.adminName || !form.email || !form.password) {
    return setError("All fields are required");
  }

  if (form.password.length < 6) {
    return setError("Password must be at least 6 characters");
  }

  if (loading) return; // ✅ prevent multiple clicks

  try {
    setLoading(true);

    /* 🔥 STEP 1: REGISTER USER (pendingUsers) */
    await api.post("/auth/register-company", {
      ...form,
      plan,
    });

    /* 🆓 TRIAL PLAN */
    if (plan === "trial") {
      alert("🎉 Company created successfully!");
      return navigate("/login");
    }

    /* 🔥 STEP 2: LOAD RAZORPAY */
    const loaded = await loadRazorpay();
    if (!loaded) {
      return setError("Razorpay SDK failed to load");
    }

    /* 🔥 STEP 3: CREATE ORDER */
    const { data } = await api.post("/payment/order", {
      plan,
      email: form.email,
    });

    if (!data?.order?.id) {
      throw new Error("Order creation failed");
    }

    /* 🔥 STEP 4: PAYMENT */
    const options = {
      key: process.env.REACT_APP_API_KEY, 
      amount: data.order.amount,
      currency: "INR",
      name: "SthitiX",
      description: `${currentPlan.name} Plan`,
      order_id: data.order.id,

      handler: async function (response) {
        try {
          await api.post("/payment/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            email: form.email,
            plan,
          });

          alert("🎉 Payment successful! Account created");

          setTimeout(() => {
            navigate("/login");
          }, 1200);

        } catch (err) {
          console.error("VERIFY ERROR:", err);
          alert("Payment successful but verification failed. Contact support.");
        }
      },

      prefill: {
        name: form.adminName,
        email: form.email,
      },

      theme: {
        color: "#2563eb",
      },
    };

    const rzp = new window.Razorpay(options);

    rzp.on("payment.failed", (err) => {
      console.error("PAYMENT FAILED:", err);
      alert("❌ Payment failed");
    });

    rzp.open();

  } catch (err) {
    console.error(err);
    setError(err.response?.data?.message || "Signup failed");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-5"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Company</h1>
          <p className="text-gray-500 text-sm">Start your SaaS journey 🚀</p>
        </div>

        <div className="bg-blue-50 p-3 rounded text-center">
          <b>{currentPlan.name} ({currentPlan.price})</b>
        </div>

        {error && (
          <div className="bg-red-100 text-red-600 p-2 rounded text-sm">
            {error}
          </div>
        )}

        <input
          placeholder="Company Name"
          className="input w-full"
          onChange={(e) =>
            setForm({ ...form, companyName: e.target.value })
          }
        />

        <input
          placeholder="Admin Name"
          className="input w-full"
          onChange={(e) =>
            setForm({ ...form, adminName: e.target.value })
          }
        />

        <input
          type="email"
          placeholder="Email"
          className="input w-full"
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          className="input w-full"
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />

        <button
          disabled={loading}
          className="bg-blue-600 text-white w-full py-2 rounded"
        >
          {loading
            ? "Processing..."
            : plan === "trial"
            ? "Start Free Trial"
            : `Pay ${currentPlan.price}`}
        </button>

        <p className="text-center text-sm">
          Already have account?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-blue-500 cursor-pointer"
          >
            Login
          </span>
        </p>
      </form>
    </div>
  );
}
