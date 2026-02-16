import React, { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronDown,
  FiLogOut,
  FiMenu,
  FiMail,
  FiMoon,
  FiSettings,
  FiStar,
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
  pinnedReports?: Array<{ id: number; title: string; tab?: string }>;
  onSelectPinnedReport?: (tab: string) => void;
  pendingItems?: Array<{ key: string; label: string; count: number; tab: string }>;
  onSelectPendingItem?: (tab: string) => void;
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
  pinnedReports = [],
  onSelectPinnedReport,
  pendingItems = [],
  onSelectPendingItem,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (pinnedRef.current && !pinnedRef.current.contains(event.target as Node)) {
        setPinnedOpen(false);
      }
      if (pendingRef.current && !pendingRef.current.contains(event.target as Node)) {
        setPendingOpen(false);
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
        print:hidden
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
        {pendingItems.length > 0 && (
          <div className="relative" ref={pendingRef}>
            <button
              onClick={() => setPendingOpen((prev) => !prev)}
              className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg px-3 py-2 transition-all border border-transparent dark:border-slate-800 text-slate-600 dark:text-slate-300"
              title="Pending documents"
            >
              <span className="text-xs font-black uppercase tracking-wider">Pending</span>
              <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-orange-600 text-white text-[10px] font-black px-1">
                {pendingItems.reduce((sum, item) => sum + Number(item.count || 0), 0)}
              </span>
              <FiChevronDown className="text-slate-500 dark:text-slate-400" />
            </button>
            {pendingOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[60]">
                {pendingItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setPendingOpen(false);
                      onSelectPendingItem?.(item.tab);
                    }}
                    className="w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors"
                  >
                    <span>{item.label}</span>
                    <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-orange-100 text-orange-700 text-[10px] font-black px-1 dark:bg-orange-900/40 dark:text-orange-300">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={pinnedRef}>
            <button
              onClick={() => setPinnedOpen((prev) => !prev)}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg px-3 py-2 transition-all border border-transparent dark:border-slate-800 text-slate-600 dark:text-slate-300"
              title="Pinned reports"
            >
              <FiStar className="text-orange-500" />
              <span className="text-xs font-black uppercase tracking-wider">Pinned</span>
              <FiChevronDown className="text-slate-500 dark:text-slate-400" />
            </button>
            {pinnedOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-[60]">
                {pinnedReports.length === 0 ? (
                  <div className="px-3 py-2 text-xs font-bold text-slate-400">
                    No pinned reports
                  </div>
                ) : (
                  pinnedReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        setPinnedOpen(false);
                        onSelectPinnedReport?.(report.tab || "reports");
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 transition-colors"
                    >
                      {report.title}
                    </button>
                  ))
                )}
              </div>
            )}
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
