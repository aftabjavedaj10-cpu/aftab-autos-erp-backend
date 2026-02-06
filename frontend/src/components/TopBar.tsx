import React from "react";

interface TopBarProps {
  onMenuClick: () => void;
  title?: string;
  userLabel?: string;
  onLogout?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick, title, userLabel, onLogout }) => {
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
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
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
          ☰
        </button>

        <h1 className="font-black text-sm uppercase text-slate-800 tracking-wide">
          {title || "Dashboard"}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Search (optional) */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg px-3 py-1">
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-slate-600 placeholder-slate-400 w-40"
          />
        </div>

        {/* Notifications */}
        <button
          className="
            w-9 h-9 rounded-lg
            flex items-center justify-center
            text-slate-600
            hover:bg-orange-500 hover:text-white
            transition-all
          "
        >
          🔔
        </button>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-black text-sm">
              {(userLabel || "A").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden md:block text-sm font-bold text-slate-700">
              {userLabel || "Admin"}
            </span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-orange-600 transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
