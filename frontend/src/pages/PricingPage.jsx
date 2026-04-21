import React, { useState } from "react";
import api from "../services/api";

/* LOAD RAZORPAY */
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const plans = [
  { name: "Free Trial", price: 0, displayPrice: "₹0", plan: "trial" },
  { name: "Pro", price: 999, displayPrice: "₹999", plan: "pro" },
  { name: "Business", price: 1999, displayPrice: "₹1999", plan: "business" },
  { name: "Premium", price: 2999, displayPrice: "₹2999", plan: "premium" },
  { name: "Enterprise", price: 6999, displayPrice: "₹6999", plan: "enterprise" },
];

export default function PricingPage() {
  const [loading, setLoading] = useState(null);

  const handlePayment = async (plan) => {
    try {
      setLoading(plan);

      if (plan === "trial") {
        window.location.href = "/signup?plan=trial";
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) return alert("Razorpay failed");

      const { data } = await api.post("/payment/order", { plan });

      const rzp = new window.Razorpay({
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: data.order.amount,
        currency: "INR",
        order_id: data.order.id,
        name: "SthitiX",

        handler: async (res) => {
          await api.post("/payment/verify", { ...res, plan });
          alert("Payment success 🎉");
          window.location.href = "/login";
        },
      });

      rzp.open();

    } catch (err) {
      console.error(err);
      alert("Payment failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-10">
      <h1>Pricing</h1>

      {plans.map((p) => (
        <button key={p.plan} onClick={() => handlePayment(p.plan)}>
          {loading === p.plan ? "Loading..." : p.name}
        </button>
      ))}
    </div>
  );
}
