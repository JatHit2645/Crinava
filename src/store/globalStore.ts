import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Using 'any' types for some complex types to guarantee compilation, 
// since the prompt says "do not alter any visual styling tokens or layout configurations"
// and we don't have the exact type definitions available yet. We'll refine if needed.
export interface GlobalState {
  coinBalance: number;
  setCoinBalance: (val: number | ((prev: number) => number)) => void;
  cricketIQ: number;
  setCricketIQ: (val: number | ((prev: number) => number)) => void;
  matches: any[];
  setMatches: (val: any[] | ((prev: any[]) => any[])) => void;
  prediction: any | null;
  setPrediction: (val: any | null | ((prev: any | null) => any | null)) => void;
  profile: any | null;
  setProfile: (val: any | null | ((prev: any | null) => any | null)) => void;
  session: any | null;
  setSession: (val: any | null | ((prev: any | null) => any | null)) => void;
  activeTab: string;
  setActiveTab: (val: string | ((prev: string) => string)) => void;
  isAdminMode: boolean;
  setIsAdminMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  raffleTickets: string[];
  setRaffleTickets: (val: string[] | ((prev: string[]) => string[])) => void;
  notifications: any[];
  setNotifications: (val: any[] | ((prev: any[]) => any[])) => void;
  verdict: any | null;
  setVerdict: (val: any | null | ((prev: any | null) => any | null)) => void;
  blogPosts: any[];
  setBlogPosts: (val: any[] | ((prev: any[]) => any[])) => void;
  raffleHistory: any[];
  setRaffleHistory: (val: any[] | ((prev: any[]) => any[])) => void;
  badges: any[];
  setBadges: (val: any[] | ((prev: any[]) => any[])) => void;
  debates: any[];
  setDebates: (val: any[] | ((prev: any[]) => any[])) => void;
  debateMessages: any[];
  setDebateMessages: (val: any[] | ((prev: any[]) => any[])) => void;
  activeDebateChat: string | null;
  setActiveDebateChat: (val: string | null | ((prev: string | null) => string | null)) => void;
  momentumData: any[];
  setMomentumData: (val: any[] | ((prev: any[]) => any[])) => void;
  careerData: any | null;
  setCareerData: (val: any | null | ((prev: any | null) => any | null)) => void;
  careerPlayer: string;
  setCareerPlayer: (val: string | ((prev: string) => string)) => void;
  selectedSmartXI: any[];
  setSelectedSmartXI: (val: any[] | ((prev: any[]) => any[])) => void;
  selectedMedal: any | null;
  setSelectedMedal: (val: any | null | ((prev: any | null) => any | null)) => void;
  selectedStage: number;
  setSelectedStage: (val: number | ((prev: number) => number)) => void;
  selectedMatch: string;
  setSelectedMatch: (val: string | ((prev: string) => string)) => void;
  raffleQuantity: number;
  setRaffleQuantity: (val: number | ((prev: number) => number)) => void;
  isSubscribed: boolean;
  setIsSubscribed: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set) => ({
      coinBalance: 0,
      setCoinBalance: (val) => set((state) => ({ coinBalance: typeof val === 'function' ? val(state.coinBalance) : val })),
      cricketIQ: 1240,
      setCricketIQ: (val) => set((state) => ({ cricketIQ: typeof val === 'function' ? val(state.cricketIQ) : val })),
      matches: [],
      setMatches: (val) => set((state) => ({ matches: typeof val === 'function' ? val(state.matches) : val })),
      prediction: null,
      setPrediction: (val) => set((state) => ({ prediction: typeof val === 'function' ? val(state.prediction) : val })),
      profile: null,
      setProfile: (val) => set((state) => ({ profile: typeof val === 'function' ? val(state.profile) : val })),
      session: null,
      setSession: (val) => set((state) => ({ session: typeof val === 'function' ? val(state.session) : val })),
      activeTab: "home",
      setActiveTab: (val) => set((state) => ({ activeTab: typeof val === 'function' ? val(state.activeTab) : val })),
      isAdminMode: false,
      setIsAdminMode: (val) => set((state) => ({ isAdminMode: typeof val === 'function' ? val(state.isAdminMode) : val })),
      raffleTickets: [],
      setRaffleTickets: (val) => set((state) => ({ raffleTickets: typeof val === 'function' ? val(state.raffleTickets) : val })),
      notifications: [],
      setNotifications: (val) => set((state) => ({ notifications: typeof val === 'function' ? val(state.notifications) : val })),
      verdict: null,
      setVerdict: (val) => set((state) => ({ verdict: typeof val === 'function' ? val(state.verdict) : val })),
      blogPosts: [],
      setBlogPosts: (val) => set((state) => ({ blogPosts: typeof val === 'function' ? val(state.blogPosts) : val })),
      raffleHistory: [],
      setRaffleHistory: (val) => set((state) => ({ raffleHistory: typeof val === 'function' ? val(state.raffleHistory) : val })),
      badges: [],
      setBadges: (val) => set((state) => ({ badges: typeof val === 'function' ? val(state.badges) : val })),
      debates: [],
      setDebates: (val) => set((state) => ({ debates: typeof val === 'function' ? val(state.debates) : val })),
      debateMessages: [],
      setDebateMessages: (val) => set((state) => ({ debateMessages: typeof val === 'function' ? val(state.debateMessages) : val })),
      activeDebateChat: null,
      setActiveDebateChat: (val) => set((state) => ({ activeDebateChat: typeof val === 'function' ? val(state.activeDebateChat) : val })),
      momentumData: [],
      setMomentumData: (val) => set((state) => ({ momentumData: typeof val === 'function' ? val(state.momentumData) : val })),
      careerData: null,
      setCareerData: (val) => set((state) => ({ careerData: typeof val === 'function' ? val(state.careerData) : val })),
      careerPlayer: "",
      setCareerPlayer: (val) => set((state) => ({ careerPlayer: typeof val === 'function' ? val(state.careerPlayer) : val })),
      selectedSmartXI: [],
      setSelectedSmartXI: (val) => set((state) => ({ selectedSmartXI: typeof val === 'function' ? val(state.selectedSmartXI) : val })),
      selectedMedal: null,
      setSelectedMedal: (val) => set((state) => ({ selectedMedal: typeof val === 'function' ? val(state.selectedMedal) : val })),
      selectedStage: 1,
      setSelectedStage: (val) => set((state) => ({ selectedStage: typeof val === 'function' ? val(state.selectedStage) : val })),
      selectedMatch: "",
      setSelectedMatch: (val) => set((state) => ({ selectedMatch: typeof val === 'function' ? val(state.selectedMatch) : val })),
      raffleQuantity: 1,
      setRaffleQuantity: (val) => set((state) => ({ raffleQuantity: typeof val === 'function' ? val(state.raffleQuantity) : val })),
      isSubscribed: true,
      setIsSubscribed: (val) => set((state) => ({ isSubscribed: typeof val === 'function' ? val(state.isSubscribed) : val })),
    }),
    {
      name: 'crinava-global-storage',
    }
  )
);
