import React, { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMenu,
  FiMail,
  FiMoon,
  FiSearch,
  FiSun,
  FiUser,
} from "react-icons/fi";

interface TopBarProps {
  onMenuClick: () => void;
  title?: string;
  userLabel?: string;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  title,
  userLabel,
  onLogout,
  isDarkMode,
  onThemeToggle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      className="
        h-14
        w-full
        flex items-center justify-between
        px-4
        bg-white/70 backdrop-blur-xl
        border-b border-white/60
        shadow-sm
      "
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="
            lg:hidden
            w-9 h-9
            rounded-lg
            flex items-center justify-center
            text-slate-600
            hover:bg-orange-500 hover:text-white
            transition-all
          "
        >
          <FiMenu />
        </button>

        <h1 className="font-black text-sm uppercase text-slate-800 tracking-wide">
          {title || "Dashboard"}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1 gap-2">
          <FiSearch className="text-slate-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400 w-40"
          />
        </div>

        <button
          className="
            w-9 h-9 rounded-lg
            flex items-center justify-center
            text-slate-600
            hover:bg-orange-500 hover:text-white
            transition-all
          "
        >
          <FiBell />
        </button>

        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className="
              w-9 h-9 rounded-lg
              flex items-center justify-center
              text-slate-600
              hover:bg-orange-500 hover:text-white
              transition-all
            "
            title={isDarkMode ? "Light mode" : "Dark mode"}
          >
            {isDarkMode ? <FiSun /> : <FiMoon />}
          </button>
        )}

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-full px-2.5 py-1 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm">
              <FiMail />
            </div>
            <FiChevronDown className="text-slate-500" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-3 w-52 bg-white border border-slate-100 rounded-2xl shadow-xl p-2 z-50">
              <div className="px-3 py-2 text-xs text-slate-500 flex items-center gap-2 border-b border-slate-100">
                <FiUser />
                <span className="truncate">{userLabel || "Admin"}</span>
              </div>
              {onLogout && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                >
                  <FiLogOut />
                  Logout
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
