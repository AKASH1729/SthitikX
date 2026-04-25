import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from "../assets/logo.jpeg";
import { motion, AnimatePresence } from 'framer-motion';
import { FiLogIn, FiMail, FiLock, FiEye, FiEyeOff, FiLoader } from 'react-icons/fi';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email.trim() || !form.password.trim()) {
      return setError("All fields are required");
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      return setError("Please enter a valid email address");
    }

    setError('');
    setLoading(true);

    try {
      const user = await login(
        form.email.trim().toLowerCase(),
        form.password.trim()
      );

      if (!user || !user.role) {
        throw new Error("Invalid user data");
      }

      await new Promise(resolve => setTimeout(resolve, 800));

      switch (user.role) {
        case "super_admin":
          navigate("/app/super-admin", { replace: true });
          break;
        case "admin":
          navigate("/app/dashboard", { replace: true });
          break;
        case "employee":
          navigate("/app/attendance", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }

    } catch (err) {
      // Handle rate limit (429) specifically
      if (err.response?.status === 429) {
        setError("You have exceeded the login attempt limit. Please try again later.");
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          "Invalid credentials. Please try again."
        );
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Left Side - Branding */}
        <motion.div 
          className="w-full md:w-2/5 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div 
            className="flex items-center space-x-4 mb-8"
            whileHover={{ scale: 1.02 }}
          >
            <div className="h-20 w-20 rounded-full border-4 border-white/20 overflow-hidden shadow-lg">
              <img
                src={logo}
                alt="Company Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                <span className="font-serif italic">Sthiti</span>
                <span className="text-blue-200 text-3xl font-bold italic">X</span>
              </h1>
              <p className="text-blue-100 text-sm">
                Workforce Intelligence Platform
              </p>
            </div>
          </motion.div>

          <motion.div 
            className="text-center text-blue-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="mb-2 text-lg font-medium">Welcome back!</p>
            <p className="text-sm">Sign in to access your dashboard and manage your workforce.</p>
          </motion.div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div 
          className="w-full md:w-3/5 p-8 sm:p-10 flex flex-col justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.h2 
            className="text-2xl font-bold text-gray-800 mb-2"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Sign In
          </motion.h2>
          <motion.p 
            className="text-gray-500 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Enter your credentials to continue
          </motion.p>

          <AnimatePresence>
            {error && (
              <motion.div 
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center justify-between"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
              >
               
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
            >
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? (
                  <>
                    <FiLoader className="animate-spin mr-2 h-4 w-4" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <FiLogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </button>
            </motion.div>
          </form>

          <motion.div 
            className="mt-6 text-center text-sm text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            Don't have an account?{' '}
            <button
              onClick={() => navigate("/", { state: { openPricing: true } })}
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            >
              Sign up
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}