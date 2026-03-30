/**
 * LoginPage — Authentication screen
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from "../assets/logo.jpeg";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]   = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'admin') setForm({ email: 'admin@geotrack.com', password: 'Admin@123' });
    else setForm({ email: 'rahul@geotrack.com', password: 'Emp@123' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
       {/* Logo */}
<div className="flex flex-col items-center mb-6">
  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white p-2 shadow-md">
    <img
      src={logo}
      alt="Mahadev Associate"
      className="w-full h-full object-contain"
    />
  </div>

  <h1 className="text-2xl font-bold text-white mt-4">
    MAHADEV ASSOCIATES
  </h1>

  <p className="text-blue-300 text-sm mt-1">
    Employee Tracking & Attendance
  </p>
</div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to continue</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Demo quick-fill */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3"></p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => fillDemo('admin')} className="btn-secondary text-xs py-1.5">
                👑 Admin login
              </button>
              <button onClick={() => fillDemo('employee')} className="btn-secondary text-xs py-1.5">
                👤 Employee login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
