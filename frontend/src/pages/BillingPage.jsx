/**
 * Billing Page — FINAL SECURE VERSION 🚀
 */

import React, { useEffect, useState } from "react";
import api from "../services/api";

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

export default function BillingPage() {
  const [data, setData] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH BILLING ================= */
  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const res = await api.get("/billing");
      setData(res.data);

      if (res.data.daysLeft <= 3) {
        setShowPopup(true);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load billing data");
    }
  };

  /* ================= PAYMENT ================= */
  const handlePay = async () => {
    try {
      setLoading(true);

      const loaded = await loadRazorpay();
      if (!loaded) {
        alert("Razorpay failed to load");
        return;
      }

      /* 🔥 CORRECT ROUTE (protected billing) */
      const { data: orderData } = await api.post(
        "/payment/billing/order"
      );

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: orderData.order.amount,
        currency: "INR",
        name: "SthitiX", // ✅ branding
        description: "Subscription Renewal",
        order_id: orderData.order.id,

        handler: async (response) => {
          try {
            /* 🔥 OPTIONAL (webhook is real source) */
            await api.post("/payment/billing/verify", response);

            alert("Payment received 🎉\nUpdating your plan...");

            setShowPopup(false);

            setTimeout(() => {
              fetchBilling(); // refresh UI
            }, 2000);

          } catch (err) {
            console.error(err);
            alert("Verification failed");
          }
        },

        modal: {
          ondismiss: () => console.log("Payment cancelled"),
        },

        theme: {
          color: "#16a34a",
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
      setLoading(false);
    }
  };

  if (!data) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">

      <h1 className="text-3xl font-bold mb-6">💰 Billing</h1>

      <div className="bg-white p-6 rounded-2xl shadow space-y-4 max-w-lg">

        <p>Plan: <b>{data.plan}</b></p>

        <p>Employees: <b>{data.employeeCount}</b></p>

        <p>Included: <b>{data.baseEmployees}</b></p>

        <p>Extra Employees: <b>{data.extraEmployees}</b></p>

        <p>Extra Cost: ₹{data.extraCost}</p>

        <p>
          Days Left:{" "}
          <b className={data.daysLeft <= 3 ? "text-red-500" : ""}>
            {data.daysLeft}
          </b>
        </p>

        <h2 className="text-xl font-bold mt-4 text-green-600">
          Total: ₹{data.total}
        </h2>

        <button
          onClick={handlePay}
          disabled={loading}
          className="bg-green-600 text-white px-5 py-2 rounded-lg mt-4 w-full hover:scale-105 transition disabled:opacity-50"
        >
          {loading ? "Processing..." : "Pay Bill 💰"}
        </button>

      </div>

      {/* ================= POPUP ================= */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">

          <div className="bg-white p-6 rounded-2xl shadow w-80 text-center">

            <h2 className="text-lg font-bold mb-2">
              ⚠ Plan Expiring Soon
            </h2>

            <p className="text-gray-600 mb-4">
              Your plan expires in <b>{data.daysLeft}</b> days.
              Please renew to avoid interruption.
            </p>

            <button
              onClick={handlePay}
              className="bg-green-600 text-white px-4 py-2 rounded w-full"
            >
              Pay Now 💰
            </button>

            <button
              onClick={() => setShowPopup(false)}
              className="mt-3 text-gray-500 text-sm"
            >
              Later
            </button>

          </div>
        </div>
      )}

    </div>
  );
}