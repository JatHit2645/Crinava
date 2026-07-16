import { create } from 'zustand';

export interface UIState {
  showAuthModal: boolean;
  setShowAuthModal: (val: boolean | ((prev: boolean) => boolean)) => void;
  showUsernameModal: boolean;
  setShowUsernameModal: (val: boolean | ((prev: boolean) => boolean)) => void;
  isRaffleModalOpen: boolean;
  setIsRaffleModalOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  showSideMenu: boolean;
  setShowSideMenu: (val: boolean | ((prev: boolean) => boolean)) => void;
  showIQ: boolean;
  setShowIQ: (val: boolean | ((prev: boolean) => boolean)) => void;
  showNotifications: boolean;
  setShowNotifications: (val: boolean | ((prev: boolean) => boolean)) => void;
  showCareerInfo: boolean;
  setShowCareerInfo: (val: boolean | ((prev: boolean) => boolean)) => void;
  showProInfo: boolean;
  setShowProInfo: (val: boolean | ((prev: boolean) => boolean)) => void;
  showBadgesModal: boolean;
  setShowBadgesModal: (val: boolean | ((prev: boolean) => boolean)) => void;
  showPredictionGame: boolean;
  setShowPredictionGame: (val: boolean | ((prev: boolean) => boolean)) => void;
  loading: boolean;
  setLoading: (val: boolean | ((prev: boolean) => boolean)) => void;
  error: string | null;
  setError: (val: string | null | ((prev: string | null) => string | null)) => void;
  isProfileLoading: boolean;
  setIsProfileLoading: (val: boolean | ((prev: boolean) => boolean)) => void;
  isMatchesContext: boolean;
  setIsMatchesContext: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showAuthModal: false,
  setShowAuthModal: (val) => set((state) => ({ showAuthModal: typeof val === 'function' ? val(state.showAuthModal) : val })),
  showUsernameModal: false,
  setShowUsernameModal: (val) => set((state) => ({ showUsernameModal: typeof val === 'function' ? val(state.showUsernameModal) : val })),
  isRaffleModalOpen: false,
  setIsRaffleModalOpen: (val) => set((state) => ({ isRaffleModalOpen: typeof val === 'function' ? val(state.isRaffleModalOpen) : val })),
  showSideMenu: false,
  setShowSideMenu: (val) => set((state) => ({ showSideMenu: typeof val === 'function' ? val(state.showSideMenu) : val })),
  showIQ: false,
  setShowIQ: (val) => set((state) => ({ showIQ: typeof val === 'function' ? val(state.showIQ) : val })),
  showNotifications: false,
  setShowNotifications: (val) => set((state) => ({ showNotifications: typeof val === 'function' ? val(state.showNotifications) : val })),
  showCareerInfo: false,
  setShowCareerInfo: (val) => set((state) => ({ showCareerInfo: typeof val === 'function' ? val(state.showCareerInfo) : val })),
  showProInfo: false,
  setShowProInfo: (val) => set((state) => ({ showProInfo: typeof val === 'function' ? val(state.showProInfo) : val })),
  showBadgesModal: false,
  setShowBadgesModal: (val) => set((state) => ({ showBadgesModal: typeof val === 'function' ? val(state.showBadgesModal) : val })),
  showPredictionGame: false,
  setShowPredictionGame: (val) => set((state) => ({ showPredictionGame: typeof val === 'function' ? val(state.showPredictionGame) : val })),
  loading: false,
  setLoading: (val) => set((state) => ({ loading: typeof val === 'function' ? val(state.loading) : val })),
  error: null,
  setError: (val) => set((state) => ({ error: typeof val === 'function' ? val(state.error) : val })),
  isProfileLoading: true,
  setIsProfileLoading: (val) => set((state) => ({ isProfileLoading: typeof val === 'function' ? val(state.isProfileLoading) : val })),
  isMatchesContext: false,
  setIsMatchesContext: (val) => set((state) => ({ isMatchesContext: typeof val === 'function' ? val(state.isMatchesContext) : val })),
}));
