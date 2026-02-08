import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { companyAdminAPI, profileAPI } from "../services/apiService";
import { setActiveCompanyId, setProfile, signUpWithPassword } from "../services/supabaseAuth";

interface SignupPageProps {
  isDarkMode: boolean;
  onThemeToggle: () => void;
  companyLogo?: string | null;
}

const SignupPage: React.FC<SignupPageProps> = ({
  isDarkMode,
  onThemeToggle,
  companyLogo,
}) => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErrorMessage("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setErrorMessage("");

    try {
      await signUpWithPassword(email, password);
      try {
        const bootstrap = await companyAdminAPI.bootstrapAdmin({
          companyName: companyName.trim() || undefined,
          fullName: fullName.trim(),
          username: username.trim(),
          phone: phone.trim(),
        });
        if (bootstrap?.company_id) {
          setActiveCompanyId(bootstrap.company_id as string);
        }
      } catch {
        // ignore bootstrap failures
      }
      try {
        const myProfile = await profileAPI.upsertMyProfile({
          full_name: fullName.trim() || undefined,
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        setProfile({
          id: myProfile.id,
          email: myProfile.email,
          fullName: myProfile.full_name ?? myProfile.fullName,
          username: myProfile.username,
          phone: myProfile.phone,
        });
      } catch {
        // profile may be blocked by RLS
      }
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed";
      if (
        message.toLowerCase().includes("rate limit") ||
        message.toLowerCase().includes("over_email_send_rate_limit")
      ) {
        setErrorMessage("Email rate limit exceeded. Try again in 10 mins.");
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcf8f2] dark:bg-[#020617] px-4 transition-colors duration-1000 relative overflow-hidden font-sans">
      <button
        onClick={onThemeToggle}
        className="absolute top-6 right-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/40 rounded-full shadow-2xl hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all group"
      >
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {isDarkMode ? "Daylight" : "Midnight"}
        </span>
        <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 shadow-inner flex items-center justify-center text-xs transform group-hover:rotate-12 transition-transform">
          {isDarkMode ? "☀️" : "🌙"}
        </div>
      </button>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-700 rounded-[2rem] flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-orange-600/40 ring-6 ring-white dark:ring-slate-900 mb-4 overflow-hidden">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              "A"
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">
            Create Admin
          </h1>
              <p className="text-slate-500 dark:text-slate-400 text-[8px] font-black uppercase tracking-[0.5em]">
                First Setup
              </p>
        </div>

        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 rounded-[2.5rem] shadow-[0_28px_56px_-16px_rgba(0,0,0,0.1)] dark:shadow-none overflow-hidden">
          <div className="p-8 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="Username"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Phone"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Company name"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="Email"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 pr-10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors p-1 text-xs"
                  >
                    {showPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.2em] ml-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Confirm password"
                  className="w-full bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-2xl py-3.5 px-4 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-xs"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-orange-600 hover:bg-orange-600 dark:hover:bg-orange-500 text-white font-black py-4 rounded-[1.2rem] shadow-2xl shadow-orange-600/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.35em]"
              >
                {isLoading ? "Creating..." : "Create Admin"}
              </button>

              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                Check your email for the OTP link to confirm your account.
              </p>

              {errorMessage && (
                <div className="text-[10px] font-bold text-red-600 dark:text-red-400">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 transition-colors"
              >
                Already have an account? Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
