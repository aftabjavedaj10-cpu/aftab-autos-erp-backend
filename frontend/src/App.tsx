import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Apply dark mode to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogin = (credentials: { email: string }) => {
    console.log('Logged in user:', credentials);
    setIsLoggedIn(true);
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
  };

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
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Dashboard />} />
        <Route path="/products/add" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
