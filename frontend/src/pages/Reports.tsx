import React, { useMemo, useState } from "react";
import { ALL_REPORTS } from "../constants";
import type { ReportDefinition } from "../constants";

const CATEGORIES = ["All", "Sales", "Inventory", "Financial", "Audit", "Tax"];

const ReportCard: React.FC<{
  report: ReportDefinition;
  isPinned: boolean;
  onTogglePin: (e: React.MouseEvent, id: number) => void;
  onAction: (tab?: string) => void;
}> = ({ report, isPinned, onTogglePin, onAction }) => (
  <div
    onClick={() => onAction(report.tab || "reports")}
    className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:border-orange-200 dark:hover:border-orange-900/40 transition-all group cursor-pointer flex flex-col h-full relative overflow-hidden"
  >
    <button
      onClick={(e) => onTogglePin(e, report.id)}
      className={`absolute top-2 right-2 p-2 rounded-xl transition-all z-10 ${
        isPinned
          ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 opacity-100"
          : "bg-slate-50 dark:bg-slate-800 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-orange-400"
      }`}
      title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"}
    >
      <span className="text-[12px]">{isPinned ? "★" : "☆"}</span>
    </button>

    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 transition-all">
        {report.icon}
      </div>
      <div className="text-right pr-6">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
          {report.category}
        </span>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight leading-tight group-hover:text-orange-600 transition-colors">
      {report.title}
    </h3>
    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium line-clamp-2 flex-1">
      {report.description}
    </p>
    <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">
        Access Analytics
      </span>
      <span className="text-sm opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all text-orange-600">
        ➜
      </span>
    </div>
  </div>
);

interface ReportsPageProps {
  onNavigate: (tab: string) => void;
  pinnedIds: number[];
  onTogglePin: (id: number) => void;
}

const ReportsPage: React.FC<ReportsPageProps> = ({
  onNavigate,
  pinnedIds,
  onTogglePin,
}) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const togglePin = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onTogglePin(id);
  };

  const filteredReports = useMemo(() => {
    return ALL_REPORTS.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === "All" || r.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, activeCategory]);

  const pinnedReports = useMemo(
    () => ALL_REPORTS.filter((r) => pinnedIds.includes(r.id)),
    [pinnedIds]
  );

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-950 dark:bg-orange-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              📊
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
              Intelligence Command
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Real-time Decision Support & Financial Ledger Analytics
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 pointer-events-none text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search Intelligence Module..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 shadow-xl outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-xs dark:text-white uppercase tracking-widest placeholder:text-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {pinnedReports.length > 0 && !search && activeCategory === "All" && (
        <section className="mb-16 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.4em] whitespace-nowrap">
              Pinned Reports
            </h2>
            <div className="h-px w-full bg-orange-100 dark:bg-orange-900/30"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {pinnedReports.map((rep) => (
              <div
                key={rep.id}
                onClick={() => onNavigate(rep.tab || "reports")}
                className="bg-gradient-to-br from-slate-950 to-slate-900 dark:from-slate-900 dark:to-black p-5 rounded-3xl shadow-2xl border border-white/10 hover:-translate-y-1 transition-all cursor-pointer group relative"
              >
                <button
                  onClick={(e) => togglePin(e, rep.id)}
                  className="absolute top-3 right-3 text-orange-400 hover:text-orange-500 transition-colors z-10"
                >
                  <span className="text-lg">★</span>
                </button>
                <div className="flex justify-between items-start mb-6">
                  <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">
                    {rep.icon}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,1)] mr-4"></span>
                </div>
                <h3 className="text-white text-xs font-black uppercase tracking-widest leading-tight">
                  {rep.title}
                </h3>
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter opacity-60">
                  High Priority Analytics
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto no-scrollbar pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              activeCategory === cat
                ? "bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-orange-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            isPinned={pinnedIds.includes(report.id)}
            onTogglePin={togglePin}
            onAction={(tab) => onNavigate(tab || "reports")}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
          <span className="text-4xl mb-4 block opacity-20">📂</span>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
            Query Empty
          </h3>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[8px] mt-1">
            Refine your strategic search parameters.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
