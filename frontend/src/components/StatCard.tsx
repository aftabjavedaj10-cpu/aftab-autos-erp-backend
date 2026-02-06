import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow hover:shadow-lg transition-all">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">
            {title}
          </p>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            {value}
          </h2>
        </div>
        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center text-lg shadow">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
