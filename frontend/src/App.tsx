import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Dashboard from "./pages/Dashboard";
import AcceptInvite from "./pages/AcceptInvite";
import {
  getActiveCompanyId,
  getSession,
  getUserId,
  setActiveCompanyId,
  setProfile,
  signOut,
} from "./services/supabaseAuth";
import { companyAPI, profileAPI, subscribeGlobalLoading } from "./services/apiService";

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const init = async () => {
      const session = getSession();
      setIsLoggedIn(!!session);
      if (session) {
        try {
          const myProfile = await profileAPI.getMyProfile();
          setProfile({
            id: myProfile.id,
            email: myProfile.email,
            fullName: myProfile.full_name ?? myProfile.fullName,
          });
          const userId = getUserId();
          if (userId && !getActiveCompanyId()) {
            const membershipRows = await companyAPI.listMyCompanies(userId);
            const firstCompany = membershipRows?.[0]?.companies;
            if (firstCompany?.id) {
              setActiveCompanyId(firstCompany.id);
            }
          }
        } catch (e) {
          console.warn("Profile load failed");
        }
      }
      setIsAuthReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    return subscribeGlobalLoading(({ isLoading }) => {
      setIsGlobalLoading(isLoading);
    });
  }, []);

  // Disable ArrowUp/ArrowDown step behavior for all numeric inputs globally.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== "INPUT") return;
      if (target.type !== "number") return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  const handleLogin = (email: string) => {
    console.log("Logged in user:", email);
    setIsLoggedIn(true);
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLogout = async () => {
    await signOut();
    setIsLoggedIn(false);
  };

  if (!isAuthReady) {
    return null;
  }

  return (
    <BrowserRouter>
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[20000] bg-slate-950/25 backdrop-blur-[1px] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-5 py-4 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Loading...
            </span>
          </div>
        </div>
      )}
      <Routes>
        {!isLoggedIn ? (
          <>
            <Route
              path="/login"
              element={
                <LoginPage
                  onLogin={handleLogin}
                  isDarkMode={isDarkMode}
                  onThemeToggle={handleThemeToggle}
                />
              }
            />
            <Route
              path="/signup"
              element={
                <SignupPage
                  isDarkMode={isDarkMode}
                  onThemeToggle={handleThemeToggle}
                />
              }
            />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route
              path="/"
              element={
                <Dashboard
                  onLogout={handleLogout}
                  isDarkMode={isDarkMode}
                  onThemeToggle={handleThemeToggle}
                />
              }
            />
            <Route
              path="/products"
              element={
                <Dashboard
                  onLogout={handleLogout}
                  isDarkMode={isDarkMode}
                  onThemeToggle={handleThemeToggle}
                />
              }
            />
            <Route
              path="/products/add"
              element={
                <Dashboard
                  onLogout={handleLogout}
                  isDarkMode={isDarkMode}
                  onThemeToggle={handleThemeToggle}
                />
              }
            />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
