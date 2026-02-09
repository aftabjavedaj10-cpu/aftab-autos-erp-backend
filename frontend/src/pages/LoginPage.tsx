
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearPendingBootstrap,
  getPendingBootstrap,
  setPermissions,
  setProfile,
  signInWithPassword,
} from "../services/supabaseAuth";
import { companyAdminAPI, permissionAPI, profileAPI } from "../services/apiService";

interface LoginPageProps {
  onLogin: (email: string) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  companyLogo?: string | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, isDarkMode, onThemeToggle, companyLogo }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [adminToast, setAdminToast] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      await signInWithPassword(email, password);
      try {
        const pending = getPendingBootstrap();
        if (pending) {
          const bootstrap = await companyAdminAPI.bootstrapAdmin(pending);
          if (bootstrap?.company_id) {
            clearPendingBootstrap();
          }
          setAdminToast("Admin setup complete");
          window.setTimeout(() => setAdminToast(""), 3000);
        }
      } catch {
        // bootstrap is best-effort; ignore if it fails
      }
      try {
        const myProfile = await profileAPI.getMyProfile();
        setProfile({
          id: myProfile.id,
          email: myProfile.email,
          fullName: myProfile.full_name ?? myProfile.fullName,
        });
      } catch {
        // profile may not exist yet
      }
      try {
        const permissions = await permissionAPI.getMyPermissions();
        if (permissions) {
          setPermissions(permissions);
        }
      } catch {
        // ignore permission refresh errors
      }
      onLogin(email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcf8f2] dark:bg-[#020617] px-4 transition-colors duration-1000 relative overflow-hidden font-sans">
      {adminToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-2xl">
          {adminToast}
        </div>
      )}
      
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute top-[-10%] left-[-5%] w-[60%] h-[60%] rounded-full blur-[150px] transition-all duration-1000 ${isDarkMode ? 'bg-orange-600/10' : 'bg-orange-500/10'}`}></div>
        <div className={`absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[130px] transition-all duration-1000 ${isDarkMode ? 'bg-blue-600/10' : 'bg-orange-200/20'}`}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] dark:opacity-[0.05]" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* Floating Theme Toggle */}
      <button 
        onClick={onThemeToggle}
        className="absolute top-6 right-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/40 rounded-full shadow-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all group"
      >
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {isDarkMode ? 'Daylight' : 'Midnight'}
        </span>
        <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 shadow-inner flex items-center justify-center text-xs transform group-hover:rotate-12 transition-transform">
          {isDarkMode ? '☀️' : '🌙'}
        </div>
      </button>

      <div className={`w-full max-w-sm transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[2rem] flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-orange-600/40 ring-6 ring-white dark:ring-slate-900 mb-4 group transition-all hover:scale-105 overflow-hidden">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : 'A'}
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">AFTAB AUTOS</h1>
          <p className="text-slate-400 dark:text-slate-500 text-[8px] font-black uppercase tracking-[0.5em]">Trusted Car Parts</p>
        </div>

        {/* Login Form Container */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 rounded-[2.5rem] shadow-[0_28px_56px_-16px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden">
          <div className="p-8 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  placeholder="account@aftabautos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required
                    className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 pr-10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors p-1"
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 px-1">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                    />
                    <div className={`w-5 h-5 border-2 rounded-lg transition-all ${rememberMe ? 'bg-orange-600 border-orange-600' : 'border-slate-200 dark:border-slate-700'}`}>
                      {rememberMe && <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">âœ“</span>}
                    </div>
                  </div>
                  <span className="ml-2 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors">Remember ME</span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black py-4 rounded-[1.2rem] shadow-2xl shadow-orange-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.35em]"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
              {errorMessage && (
                <div className="text-[10px] font-bold text-red-600 dark:text-red-400">
                  {errorMessage}
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 transition-colors"
              >
                First time here? Create Admin
              </button>
            </form>
          </div>
        </div>
        
        <div className="mt-8 text-center opacity-40">
          <p className="text-slate-400 dark:text-slate-600 text-[9px] uppercase font-black tracking-[0.45em]">
            Â© 2024 AUTOMOTIVE INTELLIGENCE SYSTEMS
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;







