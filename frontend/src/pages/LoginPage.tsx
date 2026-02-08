
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  setProfile,
  sendEmailOtp,
  signInWithPassword,
  verifyEmailOtp,
} from "../services/supabaseAuth";
import { companyAdminAPI, profileAPI } from "../services/apiService";

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
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (useOtp) {
        if (!otpSent) {
          await sendEmailOtp(email);
          setOtpSent(true);
          setErrorMessage("OTP sent to your email.");
          return;
        }
        if (!otpCode.trim()) {
          setErrorMessage("Enter the OTP code from your email.");
          return;
        }
        await verifyEmailOtp(email, otpCode.trim());
      } else {
        await signInWithPassword(email, password);
      }
      try {
        await companyAdminAPI.bootstrapAdmin();
        setAdminToast("Admin setup complete");
        window.setTimeout(() => setAdminToast(""), 3000);
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
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-2xl">
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
        className="absolute top-8 right-8 z-50 flex items-center gap-3 px-4 py-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/40 rounded-full shadow-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all group"
      >
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {isDarkMode ? 'Daylight' : 'Midnight'}
        </span>
        <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-inner flex items-center justify-center text-sm transform group-hover:rotate-12 transition-transform">
          {isDarkMode ? 'â˜€ï¸' : 'ðŸŒ™'}
        </div>
      </button>

      <div className={`w-full max-w-md transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[2.5rem] flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-orange-600/40 ring-8 ring-white dark:ring-slate-900 mb-6 group transition-all hover:scale-105 overflow-hidden">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : 'A'}
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">AFTAB AUTOS</h1>
          <p className="text-slate-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-[0.6em]">Trusted Car Parts</p>
        </div>

        {/* Login Form Container */}
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden">
          <div className="p-10 md:p-14">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Email</label>
                <input 
                  type="email" 
                  required
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-5 px-6 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-sm"
                  placeholder="account@aftabautos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {!useOtp ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required
                      className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-5 px-6 pr-14 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-sm"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors p-1"
                    >
                      {showPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {otpSent && (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-1">OTP Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-5 px-6 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-sm tracking-[0.3em]"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

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
                  <span className="ml-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-orange-500 transition-colors">Remember ME</span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black py-6 rounded-[1.5rem] shadow-2xl shadow-orange-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 text-xs uppercase tracking-[0.4em]"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <span>{useOtp ? (otpSent ? "Verify OTP" : "Send OTP") : "Login"}</span>
                    <span className="text-xl leading-none">âžœ</span>
                  </>
                )}
              </button>
              {errorMessage && (
                <div className="text-xs font-bold text-red-600 dark:text-red-400">
                  {errorMessage}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setUseOtp(!useOtp);
                  setOtpSent(false);
                  setOtpCode("");
                  setErrorMessage("");
                }}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 transition-colors"
              >
                {useOtp ? "Use Password Instead" : "Login with OTP"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 transition-colors"
              >
                First time here? Create Admin
              </button>
            </form>
          </div>
        </div>
        
        <div className="mt-12 text-center opacity-40">
          <p className="text-slate-400 dark:text-slate-600 text-[10px] uppercase font-black tracking-[0.5em]">
            Â© 2024 AUTOMOTIVE INTELLIGENCE SYSTEMS
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;





