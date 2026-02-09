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
import { companyAPI, profileAPI } from "./services/apiService";

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
