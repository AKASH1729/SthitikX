/**
 * Pricing Page — FINAL SECURE VERSION 🚀 (Webhook Ready)
 */

import React, { useState } from "react";
import axios from "axios"; // ✅ public API (no auth)

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

/* ================= PLAN CONFIG ================= */
const plans = [
  {
    name: "Free Trial",
    price: 0,
    displayPrice: "₹0",
    desc: "30 days free",
    limit: "50 employees",
    btn: "Start Free",
    plan: "trial",
  },
  {
    name: "Pro",
    price: 999,
    displayPrice: "₹999",
    desc: "per month",
    limit: "50 employees",
    btn: "Buy Now",
    plan: "pro",
  },
  {
    name: "Business",
    price: 1999,
    displayPrice: "₹1999",
    desc: "per month",
    limit: "100 employees",
    btn: "Buy Now",
    plan: "business",
  },
  {
    name: "Premium",
    price: 2999,
    displayPrice: "₹2999",
    desc: "per month",
    limit: "200 employees",
    btn: "Buy Now",
    plan: "premium",
  },
  {
    name: "Enterprise",
    price: 6999,
    displayPrice: "₹6999",
    desc: "per month",
    limit: "700 employees", // ✅ FIXED
    btn: "Buy Now",
    plan: "enterprise",
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState(null);

  const handlePayment = async (selectedPlan) => {
    try {
      setLoadingPlan(selectedPlan.plan);

      /* 🆓 TRIAL */
      if (selectedPlan.plan === "trial") {
        window.location.href = `/signup?plan=trial`;
        return;
      }

      /* 🔥 LOAD SDK */
      const loaded = await loadRazorpay();
      if (!loaded) {
        alert("Razorpay SDK failed to load");
        return;
      }

      /* 🔥 CREATE ORDER (PUBLIC API) */
      const { data } = await axios.post(
        `${process.env.REACT_APP_API_URL}/payment/order`,
        { plan: selectedPlan.plan }
      );

      if (!data?.order?.id) {
        throw new Error("Order creation failed");
      }

      /* 🔥 OPEN RAZORPAY */
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: data.order.amount,
        currency: "INR",
        name: "SthitiX", // ✅ branding updated
        description: `${selectedPlan.name} Plan`,
        order_id: data.order.id,

        handler: async (response) => {
          try {
            // ✅ OPTIONAL (not trusted anymore)
            await axios.post(
              `${process.env.REACT_APP_API_URL}/payment/verify`,
              {
                ...response,
                plan: selectedPlan.plan,
              }
            );

            // 🔥 IMPORTANT: don't trust this fully
            alert("Payment received 🎉\nActivating your account...");

            setTimeout(() => {
              window.location.href = "/login";
            }, 2500);

          } catch (err) {
            console.error(err);
            alert("Verification failed");
          }
        },

        modal: {
          ondismiss: () => console.log("Payment cancelled"),
        },

        prefill: {
          email: localStorage.getItem("email") || "",
        },

        theme: {
          color: "#2563eb",
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function () {
        alert("❌ Payment failed");
      });

      rzp.open();

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Payment failed");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="p-10 bg-gradient-to-br from-gray-50 via-white to-blue-50 min-h-screen">

      <h1 className="text-4xl font-bold text-center mb-12">
        Pricing Plans 💰
      </h1>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">

        {plans.map((p, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl shadow-md hover:shadow-2xl transition duration-300 border"
          >
            <h2 className="text-xl font-bold">{p.name}</h2>

            <p className="text-3xl font-bold my-3 text-blue-600">
              {p.displayPrice}
            </p>

            <p className="text-gray-500">{p.desc}</p>

            <p className="mt-4 font-medium text-sm">
              👥 {p.limit}
            </p>

            <button
              onClick={() => handlePayment(p)}
              disabled={loadingPlan === p.plan}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-full mt-5 py-2 rounded-xl hover:scale-105 transition disabled:opacity-50"
            >
              {loadingPlan === p.plan ? "Processing..." : p.btn}
            </button>
          </div>
        ))}

      </div>

    </div>
  );
}