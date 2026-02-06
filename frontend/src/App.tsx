import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import { getSession, signOut } from "./services/supabaseAuth";

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
    const session = getSession();
    setIsLoggedIn(!!session);
    setIsAuthReady(true);
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

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <LoginPage 
        onLogin={handleLogin} 
        isDarkMode={isDarkMode} 
        onThemeToggle={handleThemeToggle}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard onLogout={handleLogout} />} />
        <Route path="/products" element={<Dashboard onLogout={handleLogout} />} />
        <Route path="/products/add" element={<Dashboard onLogout={handleLogout} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
