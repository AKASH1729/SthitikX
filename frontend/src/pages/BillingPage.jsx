import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    fetchBilling();
  }, []);

  const fetchBilling = async () => {
    try {
      const res = await api.get("/billing");
      setData(res.data);
      if (res.data.daysLeft <= 3) setShowPopup(true);
    } catch (err) {
      console.error(err);
      alert("Failed to load billing");
    }
  };

  const handlePay = async () => {
    // Block if no payment needed
    if (data.total === 0) {
      alert("✅ No payment required. You are within your plan.");
      return;
    }

    try {
      setLoading(true);
      const loaded = await loadRazorpay();
      if (!loaded) return alert("Payment gateway failed to load");
      const { data: orderData } = await api.post("/payment/billing/order");
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: orderData.order.amount,
        currency: "INR",
        name: "SthitiX",
        description: "Subscription Renewal",
        order_id: orderData.order.id,
        handler: async (response) => {
          await api.post("/payment/billing/verify", response);
          alert("Payment successful 🎉");
          fetchBilling();
        },
      };
      new window.Razorpay(options).open();
    } catch (err) {
      console.error(err);
      alert("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const isOverLimit = data.employeeCount > data.baseEmployees;
  const isLimitReached = data.employeeCount >= data.maxAllowed;
  const isExpiringSoon = data.daysLeft <= 3;
  const noPaymentNeeded = data.total === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center sm:text-left"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">
            Billing Overview
          </h1>
          <p className="text-gray-500 mt-2">Manage your subscription and payments</p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          <div className="p-6 sm:p-8">
            {/* Plan & Pricing */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100">
              <div>
                <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">Current Plan</span>
                <h2 className="text-2xl font-bold text-gray-800 mt-1">{data.plan}</h2>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-500">Base price</span>
                <p className="text-2xl font-bold text-gray-800">₹{data.basePrice}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
              <StatCard label="Employees" value={data.employeeCount} />
              <StatCard label="Included" value={data.baseEmployees} />
              <StatCard label="Max Allowed" value={data.maxAllowed} highlight={isLimitReached} />
            </div>

            {/* Extra Employees Warning */}
            {isOverLimit && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-semibold text-amber-800">Extra Employees</p>
                    <p className="text-amber-700 text-sm mt-1">
                      {data.extraEmployees} employee(s) beyond your plan
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-700">Extra Charges</p>
                    <p className="text-lg font-bold text-amber-800">₹{data.extraCost}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Limit Reached Warning */}
            {isLimitReached && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4"
              >
                <p className="font-semibold text-red-800 text-center">
                  Maximum employee limit reached. Please upgrade your plan.
                </p>
              </motion.div>
            )}

            {/* Days Left Progress Bar (UX touch) */}
            <div className="mt-8">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>Days Left</span>
                <span className={isExpiringSoon ? "text-red-500 font-medium" : ""}>{data.daysLeft} days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isExpiringSoon ? "bg-red-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (data.daysLeft / 30) * 100)}%` }}
                />
              </div>
            </div>

            {/* Total Payable */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-600">Total Payable</span>
                <span className={`text-3xl font-bold ${noPaymentNeeded ? "text-green-600" : "text-gray-800"}`}>
                  ₹{data.total}
                </span>
              </div>
              {noPaymentNeeded && (
                <p className="text-green-600 text-sm mt-1 flex items-center gap-1">
                  ✅ All good – no payment required
                </p>
              )}
            </div>

            {/* Pay Button - SMART UX */}
            <button
              onClick={handlePay}
              disabled={loading || noPaymentNeeded}
              className={`mt-8 w-full py-3 font-semibold rounded-xl shadow-md transition-all duration-200 ${
                noPaymentNeeded
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                  : "bg-gradient-to-r from-green-600 to-green-700 text-white hover:shadow-lg hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </div>
              ) : noPaymentNeeded ? (
                "No Payment Required ✅"
              ) : (
                `Pay ₹${data.total}`
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Expiry Popup - Smart version */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center"
            >
              <h2 className="text-xl font-bold text-amber-600 mb-2">Plan Expiring Soon</h2>
              <p className="text-gray-600 mb-4">
                Your plan expires in <span className="font-bold text-amber-600">{data.daysLeft}</span> days.
                {!noPaymentNeeded && " Renew now to avoid interruption."}
                {noPaymentNeeded && " Your current usage is within limits – no payment is needed to continue."}
              </p>
              {!noPaymentNeeded ? (
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition"
                >
                  {loading ? "Processing..." : `Pay ₹${data.total}`}
                </button>
              ) : (
                <button
                  onClick={() => setShowPopup(false)}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
                >
                  Got it
                </button>
              )}
              <button
                onClick={() => setShowPopup(false)}
                className="mt-3 text-gray-400 text-sm hover:text-gray-600 transition block mx-auto"
              >
                {noPaymentNeeded ? "Close" : "Maybe later"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Helper Stat Card */
const StatCard = ({ label, value, highlight = false }) => (
  <div className={`bg-gray-50 rounded-xl p-4 text-center border ${highlight ? "border-red-200" : "border-transparent"}`}>
    <p className="text-sm text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${highlight ? "text-red-500" : "text-gray-800"}`}>{value}</p>
  </div>
);
