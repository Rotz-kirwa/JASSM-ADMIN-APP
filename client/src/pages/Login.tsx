import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-700"></div>

      <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative z-10 animate-slide-up">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600/20 text-blue-400 mb-4">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Portal</h1>
          <p className="text-slate-400 mt-2">Sign in to manage your payments</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="email" 
                placeholder="eliudkirwa451@gmail.com"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 ring-blue-500/40 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 ring-blue-500/40 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center space-x-2 text-slate-400 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0" />
              <span className="group-hover:text-slate-300 transition-colors">Remember me</span>
            </label>
            <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Forgot password?</a>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold flex items-center justify-center space-x-2 hover:from-blue-500 hover:to-blue-400 transition-all transform active:scale-[0.98] shadow-lg shadow-blue-600/25"
          >
            <span>Sign In</span>
            <ArrowRight size={20} />
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-500 text-sm">
            Powered by <span className="text-slate-300 font-semibold tracking-wide">JASSM PAY</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
