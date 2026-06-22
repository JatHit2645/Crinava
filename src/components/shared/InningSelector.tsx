import React from "react";

interface InningSelectorProps {
  activeInning: number;
  setActiveInning: (inning: number) => void;
}

export const InningSelector: React.FC<InningSelectorProps> = ({
  activeInning,
  setActiveInning,
}) => {
  return (
    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
      <button
        onClick={() => setActiveInning(0)}
        className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${activeInning === 0 ? "text-aurora-teal bg-aurora-teal/10" : "text-gray-500 hover:text-white"}`}
      >
        Inning 1
      </button>
      <button
        onClick={() => setActiveInning(1)}
        className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${activeInning === 1 ? "text-aurora-teal bg-aurora-teal/10" : "text-gray-500 hover:text-white"}`}
      >
        Inning 2
      </button>
    </div>
  );
};
