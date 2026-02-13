import React, { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMenu,
  FiMail,
  FiMoon,
  FiSearch,
  FiSettings,
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
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onMenuClick,
  title,
  userLabel,
  onLogout,
  isDarkMode,
  onThemeToggle,
  onOpenSettings,
  onOpenProfile,
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
        sticky top-0 z-50
        h-14
        w-full
        flex items-center justify-between
        px-4
        bg-white/70 dark:bg-slate-950/85 backdrop-blur-xl
        border-b border-white/60 dark:border-slate-800/80
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
            text-slate-600 dark:text-slate-300
            hover:bg-orange-500 hover:text-white
            transition-all
          "
        >
          <FiMenu />
        </button>

        <h1 className="font-black text-sm uppercase text-slate-800 dark:text-slate-100 tracking-wide">
          {title || "Dashboard"}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg px-3 py-1 gap-2 border border-transparent dark:border-slate-800">
          <FiSearch className="text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-slate-600 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 w-40"
          />
        </div>

        <button
          className="
            w-9 h-9 rounded-lg
            flex items-center justify-center
            text-slate-600 dark:text-slate-300
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
              text-slate-600 dark:text-slate-300
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
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full px-2.5 py-1 transition-all border border-transparent dark:border-slate-800"
          >
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm">
              <FiMail />
            </div>
            <FiChevronDown className="text-slate-500 dark:text-slate-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[60]">
              <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                <FiUser />
                <span className="truncate">{userLabel || "Admin"}</span>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenProfile?.();
                }}
                className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors"
              >
                <FiUser />
                Profile
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSettings?.();
                }}
                className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors"
              >
                <FiSettings />
                Settings
              </button>
              {onLogout && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors"
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
