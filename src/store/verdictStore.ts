import { create } from "zustand";

interface VerdictStore {
  selectedPlayerIds: string[];
  playerProfileId: string | null;
  addPlayer: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
  clearVerdict: () => void;
  setPlayerProfileId: (id: string | null) => void;
}

export const useVerdictStore = create<VerdictStore>((set) => ({
  selectedPlayerIds: [],
  playerProfileId: null,
  addPlayer: (playerId) =>
    set((state) => ({
      selectedPlayerIds: state.selectedPlayerIds.includes(playerId)
        ? state.selectedPlayerIds
        : [...state.selectedPlayerIds, playerId],
    })),
  removePlayer: (playerId) =>
    set((state) => ({
      selectedPlayerIds: state.selectedPlayerIds.filter(
        (id) => id !== playerId,
      ),
    })),
  clearVerdict: () => set({ selectedPlayerIds: [] }),
  setPlayerProfileId: (id) => set({ playerProfileId: id }),
}));
