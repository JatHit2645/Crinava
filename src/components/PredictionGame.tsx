import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, MessageSquare, User, BarChart3, Target, ChevronRight, X, Lock, Unlock, Zap, Shield, Star, AlertTriangle, Clock, LogOut, Volume2, VolumeX, Copy, Check, ArrowLeft } from 'lucide-react';

const API_KEY = '$2a$10$zlgjKE7cSjNvtN/aj9L1HOIqi9HxqWmXzwVbc6rkPZBbqGt1sQNdG';
const BIN_URL = 'https://api.jsonbin.io/v3/b';

const TEAMS: Record<string, any> = {
  RCB:{name:'Royal Challengers Bengaluru',short:'RCB',logo:'🔴'},
  SRH:{name:'Sunrisers Hyderabad',short:'SRH',logo:'🟠'},
  MI :{name:'Mumbai Indians',short:'MI',logo:'🔵'},
  KKR:{name:'Kolkata Knight Riders',short:'KKR',logo:'🟣'},
  RR :{name:'Rajasthan Royals',short:'RR',logo:'🩷'},
  CSK:{name:'Chennai Super Kings',short:'CSK',logo:'🟡'},
  PBKS:{name:'Punjab Kings',short:'PBKS',logo:'❤️'},
  GT :{name:'Gujarat Titans',short:'GT',logo:'🩵'},
  LSG:{name:'Lucknow Super Giants',short:'LSG',logo:'🟢'},
  DC :{name:'Delhi Capitals',short:'DC',logo:'💙'},
};

const MATCHES = [
  {id:1 ,h:'RCB',a:'SRH',date:'28 Mar',day:'Sat',time:'7:30 PM',ts:1774706400000},
  {id:2 ,h:'MI' ,a:'KKR',date:'29 Mar',day:'Sun',time:'7:30 PM',ts:1774792800000},
  {id:3 ,h:'RR' ,a:'CSK',date:'30 Mar',day:'Mon',time:'7:30 PM',ts:1774879200000},
  {id:4 ,h:'PBKS',a:'GT',date:'31 Mar',day:'Tue',time:'7:30 PM',ts:1774965600000},
  {id:5 ,h:'LSG',a:'DC',date:'01 Apr',day:'Wed',time:'7:30 PM',ts:1775052000000},
  {id:6 ,h:'KKR',a:'SRH',date:'02 Apr',day:'Thu',time:'7:30 PM',ts:1775138400000},
  {id:7 ,h:'CSK',a:'PBKS',date:'03 Apr',day:'Fri',time:'7:30 PM',ts:1775224800000},
  {id:8 ,h:'DC' ,a:'MI',date:'04 Apr',day:'Sat',time:'3:30 PM',ts:1775296800000},
  {id:9 ,h:'GT' ,a:'RR',date:'04 Apr',day:'Sat',time:'7:30 PM',ts:1775311200000},
  {id:10,h:'SRH',a:'LSG',date:'05 Apr',day:'Sun',time:'3:30 PM',ts:1775383200000},
  {id:11,h:'RCB',a:'CSK',date:'05 Apr',day:'Sun',time:'7:30 PM',ts:1775397600000},
  {id:12,h:'KKR',a:'PBKS',date:'06 Apr',day:'Mon',time:'7:30 PM',ts:1775484000000},
  {id:13,h:'RR' ,a:'MI',date:'07 Apr',day:'Tue',time:'7:30 PM',ts:1775570400000},
  {id:14,h:'DC' ,a:'GT',date:'08 Apr',day:'Wed',time:'7:30 PM',ts:1775656800000},
  {id:15,h:'KKR',a:'LSG',date:'09 Apr',day:'Thu',time:'7:30 PM',ts:1775743200000},
  {id:16,h:'RR' ,a:'RCB',date:'10 Apr',day:'Fri',time:'7:30 PM',ts:1775829600000},
  {id:17,h:'PBKS',a:'SRH',date:'11 Apr',day:'Sat',time:'3:30 PM',ts:1775901600000},
  {id:18,h:'CSK',a:'DC',date:'11 Apr',day:'Sat',time:'7:30 PM',ts:1775916000000},
  {id:19,h:'LSG',a:'GT',date:'12 Apr',day:'Sun',time:'3:30 PM',ts:1775988000000},
  {id:20,h:'MI' ,a:'RCB',date:'12 Apr',day:'Sun',time:'7:30 PM',ts:1776002400000},
];

const PLAYER_INFO: Record<string, any> = {
  rohit:{name:'Rohit Sharma',team:'Mumbai Indians',emoji:'🏏',theme:'t-rohit',color:'#2196f3',badge:'The Hitman Faithful'},
  virat:{name:'Virat Kohli',team:'RCB',emoji:'🔥',theme:'t-virat',color:'#f44336',badge:'Kohli Believer'},
  dhoni:{name:'MS Dhoni',team:'Chennai Super Kings',emoji:'💛',theme:'t-dhoni',color:'#ffd600',badge:'Thala Forever'},
};

const ALL_EMOJIS = [
  '😎','😤','🔥','💀','👑','🫡','😈','🏏','⚡','🎯','💪','🧠','😏','🤩','🥶',
  '🫣','🎪','🏆','💎','⭐','🌟','✨','🔮','🎭','🦁','🐯','🦊','🐺','🦅','🦋',
  '🌪️','💥','🎸','🏹','⚔️','🛡️','🎲','🃏','🎮','👾','🤖','👻','💫','🌈','❄️',
  '🌊','🌙','☀️','🌸','🍀','🎋','🎊','🎉','🎈','🎁','🏅','🥇','🎖️','🏵️','🚀',
  '💣','🎳','🥊','🏋️','🤸','🧗','🏄','⛷️','🎿','🛹','🏇','🎠','🎡','🎢','🎭',
];

interface GameState {
  room: string;
  bid: string;
  p1: string;
  p2: string;
  me: 'p1' | 'p2' | null;
  preds: Record<string, any>;
  results: Record<string, any>;
  p1prof: any;
  p2prof: any;
  myProf: { player: string | null; emoji: string; pin: string };
}

export function PredictionGame({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<'splash' | 'setup' | 'onboard' | 'game'>('splash');
  const [st, setSt] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem('ca26');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { room: '', bid: '', p1: '', p2: '', me: null, preds: {}, results: {}, p1prof: {}, p2prof: {}, myProf: { player: null, emoji: '😎', pin: '' } };
  });

  const [activeTab, setActiveTab] = useState<'predict'|'results'|'oracle'|'stats'|'profile'>('predict');
  const [loading, setLoading] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  
  // Setup inputs
  const [p1Input, setP1Input] = useState(st.p1 || '');
  const [p2Input, setP2Input] = useState(st.p2 || '');
  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);

  // Onboard state
  const [onboardStep, setOnboardStep] = useState(0);
  const [tempProf, setTempProf] = useState({ player: null as string | null, emoji: '😎', pin: '' });

  // Sync
  const saveSt = (newSt: GameState) => {
    setSt(newSt);
    localStorage.setItem('ca26', JSON.stringify({
      room: newSt.room, bid: newSt.bid, p1: newSt.p1, p2: newSt.p2,
      me: newSt.me, myProf: newSt.myProf
    }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const genCode = () => {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = ''; for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random()*c.length)];
    return s;
  };

  const syncSave = async (currentState: GameState) => {
    const data = {
      room: currentState.room, p1: currentState.p1, p2: currentState.p2,
      preds: currentState.preds, results: currentState.results,
      p1prof: currentState.me === 'p1' ? {player: currentState.myProf.player, emoji: currentState.myProf.emoji} : currentState.p1prof,
      p2prof: currentState.me === 'p2' ? {player: currentState.myProf.player, emoji: currentState.myProf.emoji} : currentState.p2prof,
    };
    try {
      if (!currentState.bid) {
        const r = await fetch(BIN_URL, {
          method: 'POST',
          headers: {'Content-Type':'application/json','X-Master-Key':API_KEY,'X-Bin-Private':'false'},
          body: JSON.stringify(data),
        });
        const j = await r.json();
        return j.metadata?.id;
      } else {
        await fetch(`${BIN_URL}/${currentState.bid}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json','X-Master-Key':API_KEY},
          body: JSON.stringify(data),
        });
        return currentState.bid;
      }
    } catch (e) {
      console.error(e);
      return currentState.bid;
    }
  };

  const syncLoad = async () => {
    if (!st.bid) return;
    try {
      const r = await fetch(`${BIN_URL}/${st.bid}/latest`, { headers: {'X-Master-Key': API_KEY} });
      const j = await r.json();
      if (j.record) {
        setSt(prev => ({
          ...prev,
          p1: j.record.p1 || prev.p1,
          p2: j.record.p2 || prev.p2,
          preds: j.record.preds || {},
          results: j.record.results || {},
          p1prof: j.record.p1prof || {},
          p2prof: j.record.p2prof || {}
        }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (st.room && st.bid && st.myProf?.player) {
      const timer = setInterval(syncLoad, 5000);
      return () => clearInterval(timer);
    }
  }, [st.room, st.bid, st.myProf?.player]);

  const handleCreate = async () => {
    if (!p1Input || !p2Input) { showToast('Enter both player names'); return; }
    setLoading('CREATING ROOM');
    const newSt: GameState = {
      ...st, p1: p1Input, p2: p2Input, room: genCode(), me: 'p1', bid: '',
      preds: {}, results: {}, p1prof: {}, p2prof: {}, myProf: { player: null, emoji: '😎', pin: '' }
    };
    const bid = await syncSave(newSt);
    newSt.bid = bid;
    saveSt(newSt);
    setLoading('');
    setView('onboard');
  };

  const handleJoin = async () => {
    if (!joinCode.includes(':')) { showToast('Paste the FULL code (e.g. ABCD12:abc123)'); return; }
    const [roomName, binId] = joinCode.split(':');
    if (!roomName || !binId) { showToast('Invalid code format'); return; }
    setLoading('JOINING ROOM');
    try {
      const r = await fetch(`${BIN_URL}/${binId}/latest`, { headers: {'X-Master-Key': API_KEY} });
      const j = await r.json();
      if (!j.record) throw new Error();
      const d = j.record;
      const newSt: GameState = {
        ...st, room: roomName, bid: binId, me: 'p2',
        p1: d.p1, p2: d.p2, preds: d.preds || {}, results: d.results || {},
        p1prof: d.p1prof || {}, p2prof: d.p2prof || {}, myProf: { player: null, emoji: '😎', pin: '' }
      };
      saveSt(newSt);
      setLoading('');
      setView('onboard');
    } catch (e) {
      setLoading('');
      showToast('Room not found! Check the code.');
    }
  };

  const handleFinishOnboard = async () => {
    if (tempProf.pin.length < 4) { showToast('Enter 4-digit PIN'); return; }
    setLoading('ENTERING ARENA');
    const newSt = { ...st, myProf: tempProf };
    if (!newSt.preds) newSt.preds = {};
    newSt.preds[`_${newSt.me}pin`] = tempProf.pin;
    await syncSave(newSt);
    saveSt(newSt);
    setLoading('');
    setView('game');
  };

  const handleConfirmPick = async (matchId: number, teamId: string) => {
    if (!st.me) return;
    const newPreds = { ...st.preds };
    if (!newPreds[matchId]) newPreds[matchId] = {};
    newPreds[matchId][st.me] = teamId;
    const newSt = { ...st, preds: newPreds };
    setSt(newSt);
    showToast('Saving...');
    await syncSave(newSt);
    showToast('Locked in! 🔒');
  };

  const handleSetResult = async (matchId: number, winner: string) => {
    const newResults = { ...st.results, [matchId]: winner };
    const newSt = { ...st, results: newResults };
    setSt(newSt);
    showToast('Saving result...');
    await syncSave(newSt);
    showToast('Result saved! Points updated ✓');
  };

  const calcScore = (player: 'p1' | 'p2') => {
    if (!st.results) return 0;
    return Object.keys(st.results).filter(mid => {
      const p = st.preds[mid];
      return p && p[player] && p[player] === st.results[mid];
    }).length;
  };

  // Render Splash
  if (view === 'splash') {
    return (
      <motion.div className="fixed inset-0 z-50 bg-aurora-950 flex flex-col items-center justify-center">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-metallic-gold to-aurora-300 tracking-[0.2em]">CRICARENA</h1>
        <p className="text-gold-base/60 tracking-[0.3em] mt-2 text-xs font-black">IPL 2026</p>
        <button 
          onClick={() => {
            if (st.room && st.bid) {
              setView(st.myProf.player ? 'game' : 'onboard');
            } else {
              setView('setup');
            }
          }} 
          className="mt-16 border border-gold-base/50 text-gold-base px-12 py-4 rounded-full tracking-widest font-black text-xs hover:bg-gold-base/10 transition-colors animate-pulse"
        >
          TAP TO ENTER
        </button>
      </motion.div>
    );
  }

  // Render Loading
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center py-32 space-y-6">
        <div className="text-gold-base font-black tracking-widest text-xl animate-pulse">{loading}</div>
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-gold-base rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-gold-base rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-gold-base rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    );
  }

  // Render Setup
  if (view === 'setup') {
    return (
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="w-full max-w-md mx-auto space-y-8 pt-8">
        <button onClick={onBack} className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-4">
          <ArrowLeft size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Hub</span>
        </button>
        <div className="text-center mb-8">
          <h2 className="text-4xl font-black text-gold-base tracking-widest">CRICARENA</h2>
          <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mt-2">PREDICT · COMPETE · WIN</p>
        </div>
        
        {!showJoin ? (
          <div className="bg-aurora-800 border border-aurora-600 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted font-black tracking-widest uppercase">Player 1 — You</label>
              <input value={p1Input} onChange={e=>setP1Input(e.target.value)} placeholder="Your name" className="w-full bg-aurora-900 border border-aurora-600 rounded-xl px-4 py-3 text-sm text-text-primary focus:border-gold-base outline-none transition-colors" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted font-black tracking-widest uppercase">Player 2 — Friend</label>
              <input value={p2Input} onChange={e=>setP2Input(e.target.value)} placeholder="Friend's name" className="w-full bg-aurora-900 border border-aurora-600 rounded-xl px-4 py-3 text-sm text-text-primary focus:border-gold-base outline-none transition-colors" />
            </div>
            <button onClick={handleCreate} className="w-full bg-gradient-to-r from-gold-base to-gold-dark text-aurora-950 font-black py-4 rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-transform">
              CREATE ROOM
            </button>
            <div className="text-center text-text-muted text-[10px] font-black uppercase tracking-widest py-2">or</div>
            <button onClick={() => setShowJoin(true)} className="w-full border border-aurora-600 text-text-primary py-4 rounded-xl text-xs font-black tracking-widest hover:border-gold-base hover:text-gold-base transition-colors">
              JOIN EXISTING ROOM
            </button>
          </div>
        ) : (
          <div className="bg-aurora-800 border border-aurora-600 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <label className="text-[10px] text-text-muted font-black tracking-widest uppercase">Room Code</label>
              <input value={joinCode} onChange={e=>setJoinCode(e.target.value)} placeholder="Paste full code (e.g. ABCD12:abc123)" className="w-full bg-aurora-900 border border-aurora-600 rounded-xl px-4 py-3 text-sm text-text-primary focus:border-gold-base outline-none transition-colors font-mono" />
            </div>
            <button onClick={handleJoin} className="w-full bg-gradient-to-r from-gold-base to-gold-dark text-aurora-950 font-black py-4 rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-transform">
              JOIN ROOM
            </button>
            <button onClick={() => setShowJoin(false)} className="w-full border border-aurora-600 text-text-primary py-4 rounded-xl text-xs font-black tracking-widest hover:border-white/40 transition-colors">
              BACK
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  // Render Onboard
  if (view === 'onboard') {
    return (
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="w-full max-w-md mx-auto space-y-8 pt-8">
        <div className="bg-aurora-800 border border-aurora-600 rounded-3xl p-8 shadow-2xl">
          {onboardStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-black text-gold-base tracking-widest">YOUR LEGEND</h3>
                <p className="text-[10px] text-text-muted font-bold mt-2">Who is your favourite cricketer?</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(PLAYER_INFO).map(([key, p]) => (
                  <button 
                    key={key} 
                    onClick={() => setTempProf({...tempProf, player: key})}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${tempProf.player === key ? 'border-gold-base bg-gold-base/10 scale-105' : 'border-aurora-600 bg-aurora-900 hover:border-aurora-600'}`}
                  >
                    <span className="text-3xl">{p.emoji}</span>
                    <span className="text-xs font-black tracking-widest">{p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              <button 
                onClick={() => tempProf.player ? setOnboardStep(1) : showToast('Pick a player!')} 
                className="w-full bg-gradient-to-r from-gold-base to-gold-dark text-aurora-950 font-black py-4 rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-transform"
              >
                NEXT →
              </button>
            </div>
          )}
          {onboardStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-black text-gold-base tracking-widest">YOUR VIBE</h3>
                <p className="text-[10px] text-text-muted font-bold mt-2">Pick an emoji for your profile.</p>
              </div>
              <div className="flex items-center justify-center gap-4 p-4 bg-aurora-900 rounded-xl border border-aurora-600/50">
                <span className="text-4xl">{tempProf.emoji}</span>
              </div>
              <div className="grid grid-cols-8 gap-2 h-48 overflow-y-auto pr-2 custom-scrollbar">
                {ALL_EMOJIS.map((e, index) => (
                  <button 
                    key={index} 
                    onClick={() => setTempProf({...tempProf, emoji: e})}
                    className={`aspect-square rounded-lg text-xl flex items-center justify-center transition-all ${tempProf.emoji === e ? 'bg-gold-base/20 border border-gold-base' : 'bg-aurora-900 border border-transparent hover:bg-aurora-700'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setOnboardStep(2)} 
                className="w-full bg-gradient-to-r from-gold-base to-gold-dark text-aurora-950 font-black py-4 rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-transform"
              >
                NEXT →
              </button>
            </div>
          )}
          {onboardStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-black text-gold-base tracking-widest">SET YOUR PIN</h3>
                <p className="text-[10px] text-text-muted font-bold mt-2">Create a 4-digit PIN to rejoin later.</p>
              </div>
              <input 
                type="text" 
                maxLength={4} 
                value={tempProf.pin} 
                onChange={e => setTempProf({...tempProf, pin: e.target.value.replace(/\D/g, '')})}
                className="w-full bg-aurora-900 border border-aurora-600 rounded-xl px-4 py-4 text-center text-2xl tracking-[1em] font-mono text-gold-base focus:border-gold-base outline-none transition-colors" 
                placeholder="••••"
              />
              <div className="flex items-start gap-3 p-4 bg-gold-base/10 border border-gold-base/20 rounded-xl">
                <AlertTriangle className="text-gold-base shrink-0" size={16} />
                <p className="text-[10px] text-gold-base leading-relaxed">Remember this PIN! You will need it to rejoin this room after leaving.</p>
              </div>
              <button 
                onClick={handleFinishOnboard} 
                className="w-full bg-gradient-to-r from-gold-base to-gold-dark text-aurora-950 font-black py-4 rounded-xl text-xs tracking-widest hover:scale-[1.02] transition-transform"
              >
                ENTER THE ARENA →
              </button>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Render Game
  const myName = st.me === 'p1' ? st.p1 : st.p2;
  const otherName = st.me === 'p1' ? st.p2 : st.p1;
  const myEmoji = st.myProf.emoji;
  const otherEmoji = (st.me === 'p1' ? st.p2prof?.emoji : st.p1prof?.emoji) || '😎';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between bg-aurora-800 border border-aurora-600 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="text-sm font-black text-gold-base tracking-widest">CRICARENA</div>
            <div className="text-[9px] text-text-muted font-black uppercase tracking-widest">Room: {st.room}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            navigator.clipboard.writeText(`${st.room}:${st.bid}`);
            showToast('Code copied!');
          }} className="p-2 bg-aurora-700/50 rounded-lg text-text-body hover:text-text-primary transition-colors">
            <Copy size={16} />
          </button>
          <button onClick={() => {
            setSt({ room: '', bid: '', p1: '', p2: '', me: null, preds: {}, results: {}, p1prof: {}, p2prof: {}, myProf: { player: null, emoji: '😎', pin: '' } });
            setView('setup');
          }} className="p-2 bg-loss-red/10 text-loss-red rounded-lg hover:bg-loss-red/20 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-aurora-800 border border-gold-base/30 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-metallic-gold to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{myEmoji}</span>
            <div>
              <div className="text-sm font-bold text-text-primary">{myName}</div>
              <div className="text-[9px] text-text-muted tracking-widest uppercase">You</div>
            </div>
          </div>
          <div className="text-5xl font-black text-gold-base">{calcScore(st.me || 'p1')}</div>
          <div className="text-[9px] text-text-muted tracking-widest uppercase mt-2">Correct Picks</div>
        </div>
        <div className="bg-aurora-800 border border-aurora-600 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-aurora-300/20 to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{otherEmoji}</span>
            <div>
              <div className="text-sm font-bold text-text-primary">{otherName}</div>
              <div className="text-[9px] text-text-muted tracking-widest uppercase">Opponent</div>
            </div>
          </div>
          <div className="text-5xl font-black text-text-primary">{calcScore(st.me === 'p1' ? 'p2' : 'p1')}</div>
          <div className="text-[9px] text-text-muted tracking-widest uppercase mt-2">Correct Picks</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-aurora-800 border border-aurora-600 rounded-xl p-1 overflow-x-auto hide-scrollbar">
        {['predict', 'results', 'oracle', 'stats', 'profile'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 min-w-[80px] py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? 'bg-gold-base text-aurora-950' : 'text-text-muted hover:text-text-primary'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'predict' && (
          <div className="space-y-4">
            {MATCHES.map((m, idx) => {
              const pred = st.preds[m.id] || {};
              const result = st.results[m.id];
              const myPick = pred[st.me || 'p1'];
              const otherPick = pred[st.me === 'p1' ? 'p2' : 'p1'];
              const both = pred.p1 && pred.p2;
              const h = TEAMS[m.h];
              const a = TEAMS[m.a];

              return (
                <motion.div 
                  initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} transition={{delay: idx*0.05}}
                  key={m.id} 
                  className="bg-aurora-800 border border-aurora-600 rounded-2xl overflow-hidden"
                >
                  <div className="flex justify-between items-center p-4 border-b border-aurora-600/50 bg-aurora-700/30">
                    <span className="text-xs font-black text-gold-base tracking-widest">MATCH {m.id}</span>
                    <div className="text-right">
                      <div className="text-[10px] text-text-body">{m.date} · {m.day}</div>
                      <div className="text-[9px] text-text-muted">{m.time}</div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                      <button 
                        onClick={() => !myPick && !result && handleConfirmPick(m.id, m.h)}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${myPick === m.h ? 'border-gold-base bg-gold-base/10' : result === m.h ? 'border-win-green bg-win-green/10' : 'border-aurora-600 bg-aurora-900 hover:border-aurora-600'} ${myPick || result ? 'cursor-default' : ''}`}
                      >
                        <span className="text-3xl">{h.logo}</span>
                        <span className="text-sm font-black tracking-widest">{h.short}</span>
                      </button>
                      <div className="text-xs font-black text-text-muted tracking-widest">VS</div>
                      <button 
                        onClick={() => !myPick && !result && handleConfirmPick(m.id, m.a)}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${myPick === m.a ? 'border-gold-base bg-gold-base/10' : result === m.a ? 'border-win-green bg-win-green/10' : 'border-aurora-600 bg-aurora-900 hover:border-aurora-600'} ${myPick || result ? 'cursor-default' : ''}`}
                      >
                        <span className="text-3xl">{a.logo}</span>
                        <span className="text-sm font-black tracking-widest">{a.short}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 p-4 border-t border-aurora-600/50 bg-aurora-950/20">
                    <div className={`flex-1 p-2 rounded-lg text-[10px] font-bold text-center border ${myPick ? 'bg-gold-base/10 border-gold-base text-gold-base' : 'bg-aurora-700/50 border-aurora-600 text-text-muted'}`}>
                      <span className="block text-[8px] opacity-60 mb-1 uppercase">{myName}</span>
                      {myPick ? `${myPick} 🔒` : '—'}
                    </div>
                    <div className={`flex-1 p-2 rounded-lg text-[10px] font-bold text-center border ${otherPick ? 'bg-aurora-700 border-aurora-600 text-text-primary' : 'bg-aurora-700/50 border-aurora-600 text-text-muted'}`}>
                      <span className="block text-[8px] opacity-60 mb-1 uppercase">{otherName}</span>
                      {otherPick ? (both ? `${otherPick} 🔒` : 'Predicted 🔒') : '—'}
                    </div>
                  </div>

                  {both && !result && (
                    <div className="p-4 border-t border-aurora-600/50 flex gap-4 items-center">
                      <select 
                        id={`res-${m.id}`}
                        className="flex-1 bg-aurora-900 border border-aurora-600 rounded-lg px-3 py-2 text-xs text-text-primary focus:border-win-green outline-none"
                      >
                        <option value="">Set Winner...</option>
                        <option value={m.h}>{m.h}</option>
                        <option value={m.a}>{m.a}</option>
                      </select>
                      <button 
                        onClick={() => {
                          const val = (document.getElementById(`res-${m.id}`) as HTMLSelectElement).value;
                          if (val) handleSetResult(m.id, val);
                        }}
                        className="bg-win-green text-aurora-950 font-black text-[10px] px-4 py-2 rounded-lg tracking-widest"
                      >
                        SET
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            {MATCHES.filter(m => (st.results || {})[m.id]).length === 0 ? (
              <div className="text-center py-20 text-text-muted text-xs font-black uppercase tracking-widest">No results yet</div>
            ) : (
              MATCHES.filter(m => (st.results || {})[m.id]).map(m => {
                const w = (st.results || {})[m.id];
                const pred = st.preds[m.id] || {};
                const p1ok = pred.p1 === w;
                const p2ok = pred.p2 === w;
                return (
                  <div key={m.id} className="bg-aurora-800 border border-aurora-600 rounded-2xl overflow-hidden">
                    <div className="flex justify-between items-center p-4 border-b border-aurora-600/50 bg-win-green/5">
                      <span className="text-xs font-black text-text-body tracking-widest">MATCH {m.id}</span>
                      <span className="text-xs font-black text-win-green tracking-widest">{w && TEAMS[w] ? TEAMS[w].short : '—'} WON 🏆</span>
                    </div>
                    <div className="flex gap-2 p-4">
                      <div className={`flex-1 p-3 rounded-xl text-xs font-bold text-center border ${p1ok ? 'bg-win-green/10 border-win-green text-win-green' : 'bg-loss-red/10 border-loss-red text-loss-red'}`}>
                        <span className="block text-[9px] opacity-60 mb-1 uppercase">{st.p1}</span>
                        {pred.p1 || '—'} {p1ok ? '✓' : '✗'}
                      </div>
                      <div className={`flex-1 p-3 rounded-xl text-xs font-bold text-center border ${p2ok ? 'bg-win-green/10 border-win-green text-win-green' : 'bg-loss-red/10 border-loss-red text-loss-red'}`}>
                        <span className="block text-[9px] opacity-60 mb-1 uppercase">{st.p2}</span>
                        {pred.p2 || '—'} {p2ok ? '✓' : '✗'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Other tabs can be implemented similarly */}
        {(activeTab === 'oracle' || activeTab === 'stats' || activeTab === 'profile') && (
          <div className="text-center py-20 bg-aurora-800 rounded-3xl border border-aurora-600/50">
            <p className="text-text-muted text-xs font-black uppercase tracking-widest">Section under construction for React</p>
          </div>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{opacity:0, y:50, x:'-50%'}} animate={{opacity:1, y:0, x:'-50%'}} exit={{opacity:0, y:20, x:'-50%'}}
            className="fixed bottom-8 left-1/2 bg-aurora-800 border border-gold-base text-text-primary px-6 py-3 rounded-full text-xs font-bold shadow-[0_0_30px_rgba(240,180,41,0.2)] z-50"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
