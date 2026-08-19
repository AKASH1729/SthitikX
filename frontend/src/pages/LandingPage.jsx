/**
 * SaaS Landing Page — ULTRA PREMIUM UI 🚀 with Enhanced Features
 * Added "Download App" button to navbar
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiArrowRight, FiClock, FiMapPin, FiBarChart2, FiShield, FiUsers, FiDownload } from "react-icons/fi";
import logo from "../assets/logo.jpeg";

/* ================= NAVBAR (with Download App button) ================= */
function Navbar({ openPricing }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex justify-between items-center px-6 md:px-10 py-5 bg-white/70 backdrop-blur-md shadow sticky top-0 z-50"
      >
        {/* LOGO + BRAND */}
        <div className="flex items-center gap-3">
          <img src={logo} className="h-10 w-auto object-contain" alt="SthitiX Logo" />
          <h1 className="text-xl font-semibold tracking-wide">
            <span className="italic font-serif">Sthiti</span>
            <span className="text-blue-600 text-2xl font-bold italic ml-1">X</span>
          </h1>
        </div>

        {/* DESKTOP NAV */}
        <div className="hidden md:flex gap-8 items-center">
          <a href="#features" className="hover:text-blue-500 transition-colors">Features</a>
          <a href="#faq" className="hover:text-blue-500 transition-colors">FAQ</a>
          <button
            onClick={() => (window.location.href = "/login")}
            className="text-gray-600 hover:text-blue-600 transition-colors"
          >
            Login
          </button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={openPricing}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-lg shadow hover:shadow-md transition-all"
          >
            Get Started
          </motion.button>

          {/* ✅ NEW: Download App button (desktop) */}
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="https://sthitix123.s3.eu-north-1.amazonaws.com/sthitix.apk"
            download
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2 rounded-lg shadow hover:shadow-md transition-all flex items-center gap-2"
          >
            <FiDownload size={18} />
            Download App
          </motion.a>
        </div>

        {/* MOBILE MENU BUTTON */}
        <button 
          className="md:hidden text-gray-600"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </motion.div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white shadow-lg"
          >
            <div className="flex flex-col p-4 space-y-4">
              <a href="#features" className="hover:text-blue-500" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#faq" className="hover:text-blue-500" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
              <button
                onClick={() => {
                  window.location.href = "/login";
                  setMobileMenuOpen(false);
                }}
                className="text-left hover:text-blue-600"
              >
                Login
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  openPricing();
                  setMobileMenuOpen(false);
                }}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2 rounded-lg shadow"
              >
                Get Started
              </motion.button>

              {/* ✅ NEW: Download App button (mobile) */}
              <motion.a
                whileTap={{ scale: 0.95 }}
                href="https://sthitix123.s3.eu-north-1.amazonaws.com/sthitix.apk"
                download
                className="bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2 rounded-lg shadow flex items-center justify-center gap-2"
              >
                <FiDownload size={18} />
                Download App
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ================= HERO ================= */
function Hero({ openPricing }) {
  return (
    <div className="text-center py-16 md:py-24 bg-gradient-to-br from-blue-50 via-white to-blue-100 px-4">
      <motion.img
        src={logo}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="h-16 md:h-20 mx-auto mb-6 drop-shadow-xl"
        alt="SthitiX Logo"
      />
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl md:text-5xl font-bold mb-6"
      >
        <span className="italic font-serif">Sthiti</span>
        <span className="text-blue-600 text-5xl md:text-6xl italic font-bold ml-2">X</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-gray-600 mb-8 text-base md:text-lg max-w-xl mx-auto"
      >
        The ultimate workforce management solution with real-time tracking, automated attendance, and powerful analytics.
      </motion.p>
      <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={openPricing}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Start Free Trial 
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.location.href = "#demo"}
          className="bg-white text-blue-600 border border-blue-600 px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          Watch Demo ▶
        </motion.button>
      </div>
      <motion.div 
        className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {[
          { icon: <FiMapPin size={24} />, text: "Real-time GPS Tracking" },
          { icon: <FiClock size={24} />, text: "Automated Attendance" },
          { icon: <FiBarChart2 size={24} />, text: "Advanced Analytics" },
          { icon: <FiShield size={24} />, text: "Enterprise Security" }
        ].map((item, index) => (
          <div key={index} className="bg-white/50 p-3 rounded-lg shadow-sm flex items-center gap-2">
            <span className="text-blue-600">{item.icon}</span>
            <span className="text-sm md:text-base">{item.text}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ================= FEATURES ================= */
function Features() {
  const features = [
    {
      title: "Live GPS Tracking",
      desc: "Monitor employee locations in real-time with precise GPS accuracy and geofencing capabilities.",
      icon: <FiMapPin className="text-blue-600" size={32} />,
      benefits: ["Real-time location updates", "Geofence alerts", "Route history"]
    },
    {
      title: "Smart Attendance",
      desc: "Automate attendance tracking with geofenced check-ins and AI-powered facial recognition.",
      icon: <FiClock className="text-blue-600" size={32} />,
      benefits: ["Automated check-in/out", "Facial recognition", "Tamper-proof records"]
    },
    {
      title: "Analytics Dashboard",
      desc: "Gain powerful insights into workforce productivity with customizable reports and visualizations.",
      icon: <FiBarChart2 className="text-blue-600" size={32} />,
      benefits: ["Custom reports", "Productivity metrics", "Export to Excel"]
    },
    {
      title: "Team Management",
      desc: "Easily organize your workforce with department structures and role-based permissions.",
      icon: <FiUsers className="text-blue-600" size={32} />,
      benefits: ["Department hierarchy", "Role-based access", "Bulk operations"]
    }
  ];

  return (
    <section id="features" className="py-16 md:py-20 bg-white px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Everything you need to efficiently manage your distributed workforce</p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="bg-blue-50 p-3 rounded-full">{feature.icon}</div>
                <div>
                  <h3 className="font-bold text-xl mb-2">{feature.title}</h3>
                  <p className="text-gray-600 mb-4">{feature.desc}</p>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <FiCheck className="text-green-500" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= DEMO SECTION ================= */
function DemoSection() {
  return (
    <section id="demo" className="py-16 md:py-20 bg-gray-50 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">See It In Action</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Watch our 2-minute demo to see how SthitiX can transform your workforce management</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="aspect-video bg-gray-200 rounded-xl shadow-xl overflow-hidden relative"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Product Demo Video</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ================= FAQ ================= */
function FAQ() {
  const faqs = [
    {
      question: "How does the geofencing feature work?",
      answer: "Our geofencing allows you to create virtual boundaries around work locations. Employees automatically check in when they enter these zones and check out when they leave."
    },
    {
      question: "Is there a mobile app for employees?",
      answer: "Yes, we provide dedicated mobile apps for Android that employees can use for clocking in/out and viewing their schedules."
    },
    {
      question: "How secure is the employee location data?",
      answer: "We use bank-grade encryption for all data transmission and storage. Location data is only accessible to authorized managers and admins."
    },
    {
      question: "Can I import my existing employee data?",
      answer: "Absolutely, we support bulk imports from Excel/CSV files and can integrate with most HRMS systems."
    }
  ];

  const [activeIndex, setActiveIndex] = useState(null);
  const toggleFAQ = (index) => setActiveIndex(activeIndex === index ? null : index);

  return (
    <section id="faq" className="py-16 md:py-20 bg-gray-50 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">Everything you need to know about SthitiX</p>
        </motion.div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button onClick={() => toggleFAQ(index)} className="w-full flex justify-between items-center p-6 bg-white hover:bg-gray-50 transition-colors">
                <h3 className="text-left font-medium text-lg">{faq.question}</h3>
                <motion.div animate={{ rotate: activeIndex === index ? 90 : 0 }}>
                  <FiArrowRight />
                </motion.div>
              </button>
              <AnimatePresence>
                {activeIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-gray-50"
                  >
                    <div className="p-6 pt-0">
                      <p className="text-gray-700">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= CTA ================= */
function CTA({ openPricing }) {
  return (
    <section className="py-16 md:py-20 bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Workforce Management?</h2>
          <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
            Join thousands of businesses using SthitiX to streamline their operations and boost productivity.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openPricing}
              className="bg-white text-blue-600 px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
            >
              Start Free Trial
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ================= FOOTER ================= */
function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} className="h-8 w-auto object-contain" alt="SthitiX Logo" />
              <h1 className="text-lg font-semibold">
                <span className="italic font-serif">Sthiti</span>
                <span className="text-blue-400 italic ml-1">X</span>
              </h1>
            </div>
            <p className="text-gray-400 text-sm">The complete workforce management solution for modern businesses.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#demo" className="hover:text-white transition-colors">Demo</a></li>
              <li><a href="/pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="/updates" className="hover:text-white transition-colors">Updates</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="/careers" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="/blog" className="hover:text-white transition-colors">Blog</a></li>
              <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="/security" className="hover:text-white transition-colors">Security</a></li>
              <li><a href="/compliance" className="hover:text-white transition-colors">Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} SthitiX. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* ================= PRICING MODAL ================= */
function PricingModal({ close }) {
  const navigate = useNavigate();
  const plans = [
    { name: "Free Trial", price: "₹0", duration: "30 days", features: ["50 employees", "Basic tracking", "Email support"], cta: "Try for Free", plan: "trial", popular: false },
    { name: "Pro", price: "₹999", duration: "per month", features: ["50 employees", "Advanced analytics", "Priority support", "Mobile apps"], cta: "Get Started", plan: "pro", popular: false },
    { name: "Business", price: "₹1999", duration: "per month", features: ["100 employees", "All Pro features", "Custom reports"], cta: "Get Started", plan: "business", popular: true },
    { name: "Premium", price: "₹2999", duration: "per month", features: ["200 employees", "Custom solutions", "24/7 support"], cta: "Get Started", plan: "premium", popular: false },
    { name: "Enterprise", price: "₹6999", duration: "per month", features: ["700 employees", "All Premium features", "Dedicated account manager", "SLA guarantee"], cta: "Get Started", plan: "enterprise", popular: false }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white p-6 rounded-2xl w-full max-w-6xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <button onClick={close} className="text-gray-500 hover:text-gray-700">✖</button>
        </div>
        <div className="grid md:grid-cols-5 gap-4">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5 }}
              className={`p-5 border rounded-xl shadow relative ${plan.popular ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}
            >
              {plan.popular && <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>}
              <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
              <div className="flex items-end mb-2">
                <span className="text-2xl font-bold text-blue-600">{plan.price}</span>
                {plan.duration && <span className="text-gray-500 text-sm ml-1">{plan.duration}</span>}
              </div>
              <ul className="space-y-2 my-4">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/signup?plan=${plan.plan}`)}
                className={`w-full mt-4 py-2 rounded font-medium ${plan.popular ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
              >
                {plan.cta}
              </motion.button>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center text-gray-600">
          <p>Need help choosing? <a href="/contact" className="text-blue-600 hover:underline">Contact our sales team</a></p>
        </div>
      </motion.div>
    </div>
  );
}

/* ================= MAIN ================= */
export default function LandingPage() {
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar openPricing={() => setShowPricing(true)} />
      <Hero openPricing={() => setShowPricing(true)} />
      <Features />
      <DemoSection />
      <FAQ />
      <CTA openPricing={() => setShowPricing(true)} />
      <Footer />
      <AnimatePresence>
        {showPricing && <PricingModal close={() => setShowPricing(false)} />}
      </AnimatePresence>
    </div>
  );
}
