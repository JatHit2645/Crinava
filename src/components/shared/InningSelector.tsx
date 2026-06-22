import React from "react";

interface InningSelectorProps {
  activeInning: number;
  setActiveInning: (inning: number) => void;
}

/**
 * Renders a two-button inning selector and updates the active inning state when a button is clicked.
 * @example
 * InningSelector({ activeInning: 0, setActiveInning })
 * <div>Inning 1 / Inning 2 selector</div>
 * @param {{number}} activeInning - The currently selected inning index, where 0 represents Inning 1 and 1 represents Inning 2.
 * @param {{(inning: number) => void}} setActiveInning - Callback used to update the selected inning index.
 * @returns {{JSX.Element}} The rendered inning selector UI.
 **/
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
