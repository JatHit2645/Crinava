import React from "react";
import { useVerdictStore } from "../store/verdictStore";
import { X } from "lucide-react";

interface VerdictTrayProps {
  onCompare?: () => void;
}

export const VerdictTray: React.FC<VerdictTrayProps> = ({ onCompare }) => {
  const { selectedPlayerIds, removePlayer } = useVerdictStore();

  if (selectedPlayerIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 bg-[#111111] border-t border-white/10 p-4 flex items-center justify-between z-50">
      <div className="flex gap-2 overflow-x-auto">
        {selectedPlayerIds.map((id) => (
          <div
            key={id}
            className="bg-white/10 px-3 py-1 rounded-full flex items-center gap-2 text-sm text-white"
          >
            <span>{id}</span>
            <button
              onClick={() => removePlayer(id)}
              className="text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onCompare}
        className="bg-metallic-gold text-black px-4 py-2 rounded-lg font-bold text-sm"
      >
        Compare ({selectedPlayerIds.length})
      </button>
    </div>
  );
};
