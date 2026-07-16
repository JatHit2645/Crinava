import argparse
import gc
import json
import logging
import os
import pickle
import random
import sys
import traceback
import warnings
from pathlib import Path
from typing import Dict, Tuple, List

import numpy as np
import pandas as pd
from tqdm.auto import tqdm

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim.lr_scheduler import ReduceLROnPlateau

from catboost import CatBoostClassifier
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge
from sklearn.model_selection import KFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss

# ============================================================
# 0. KAGGLE POWER LOGGING (The Final Fix)
# ============================================================
for handler in logging.root.handlers[:]: logging.root.removeHandler(handler)
log = logging.getLogger("crinava_v15")
log.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S"))
log.addHandler(handler)
log.propagate = False

def flush_log(msg):
    log.info(msg)
    sys.stdout.flush()


warnings.filterwarnings("ignore")
tqdm.pandas()

# ============================================================
# 1. REPRODUCIBILITY & GLOBAL CONSTANTS
# ============================================================
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

BATCH_SIZE = 256
SEQ_LENGTH = 18
LSTM_EPOCHS = 10 # Optimized for GPU speed
LSTM_PATIENCE = 3
MAX_MATCHES_LSTM = 8000
MAX_VAL_MATCHES_LSTM = 1500

TRAIN_SPLIT_RATIO = 0.70
VAL_SPLIT_RATIO = 0.15

FORCE_CPU = False # 🚀 SPEED BOOST: Enable GPU
DEVICE = torch.device("cuda" if torch.cuda.is_available() and not FORCE_CPU else "cpu")
# 🛡️ Hybrid Fix: Force LSTM to CPU to bypass Kaggle P100 PyTorch bug
LSTM_DEVICE = torch.device("cpu")
if torch.cuda.is_available():
    torch.backends.cudnn.enabled = False
torch.set_num_threads(8) # Maximize CPU speed for the LSTM
log.info(f"🚀 V15 ZERO-ERROR MASTERPIECE INITIALIZED | Device: {DEVICE}")

REQUIRED_COLS = [
    "match_id", "innings_no", "over_no", "ball_no",
    "runs_total", "wicket_kind", "match_type", "extras_type_raw"
]

NUMERIC_FEATURES = ["runs_needed", "balls_remaining", "wickets_left", "rrr", "crr", "cumulative_runs", "cumulative_wkts", "target", "roll6_runs", "roll6_wkts", "partnership_runs"]
CATEGORICAL_COLS = ["batting_team", "bowling_team", "venue", "phase", "innings_no"]
CATEGORICAL_ENC = [c + "_enc" for c in CATEGORICAL_COLS]
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_ENC
CATBOOST_FEATURES = NUMERIC_FEATURES + CATEGORICAL_ENC  # Using int encodings to prevent crashes
LSTM_FEATURE_COLS = ["true_runs", "is_wicket", "over_no", "ball_no", "crr", "rrr", "runs_needed", "balls_remaining", "wickets_left", "phase_enc", "partnership_runs", "partnership_wickets"]

# ============================================================
# 2. HELPER FUNCTIONS
# ============================================================
def clear_memory():
    gc.collect()

def _get_phase(balls_bowled: int, fmt: str) -> str:
    over = balls_bowled // 6
    if fmt == "T20":
        if over < 6: return "powerplay"
        if over < 15: return "middle"
        return "death"
    else:
        if over < 10: return "p1"
        if over < 40: return "p2"
        return "p3"

def _is_legal_delivery(raw_extras) -> bool:
    if pd.isna(raw_extras) or raw_extras in (None, "{}", "", "nan"): return True
    s = str(raw_extras).lower()
    return not any(x in s for x in ["wide", "no ball", "noball"])

# ============================================================
# 3. ARCHITECTURE (LSTM explicitly bidirectional=False)
# ============================================================
class MomentumDataset(Dataset):
    def __init__(self, sequences: np.ndarray, labels: np.ndarray):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.float32)
    def __len__(self) -> int: return len(self.sequences)
    def __getitem__(self, idx: int): return self.sequences[idx], self.labels[idx]

class CrinavaLSTM(nn.Module):
    def __init__(self, input_dim: int = 12, hidden_dim: int = 256, num_layers: int = 2):
        super().__init__()
        # Explicit bidirectional=False to enforce strict causal timeline
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.3, bidirectional=False)
        self.bn = nn.BatchNorm1d(hidden_dim)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (hn, _) = self.lstm(x)
        h = self.bn(hn[-1])
        return torch.sigmoid(self.fc(self.dropout(h)))

# ============================================================
# 4. HIGH-PRECISION PHYSICS & MONTE CARLO
# ============================================================
def calculate_smart_par(df: pd.DataFrame, fmt: str) -> Tuple[pd.DataFrame, float]:
    """Builds the Year-Venue Context Table (Smart Par)."""
    log.info(f"🧠 [{fmt}] Calculating Smart Par Table (Year-Venue Context)...")
    inn1 = df[(df["innings_no"] == 1)].groupby(["match_id", "venue", "year"])["true_runs"].sum().reset_index()
    par_df = inn1.groupby(["venue", "year"])["true_runs"].mean().reset_index()
    par_df.rename(columns={"true_runs": "par_score"}, inplace=True)
    global_par = par_df["par_score"].mean()
    if np.isnan(global_par): global_par = 165 if fmt == "T20" else 275
    return par_df, global_par

def calculate_twin_multipliers(df: pd.DataFrame, fmt: str, min_matches: int = 5) -> pd.DataFrame:
    """Calculates Stadium Aggression (Run & Wicket Multipliers) using Min-5 Rule."""
    log.info(f"🧬 [{fmt}] Calculating Twin Multipliers (Runs & Wickets | Min 5 Rule)...")
    total_runs, total_wickets, total_balls = df["true_runs"].sum(), df["is_wicket"].sum(), df["is_legal"].sum()
    g_rr = total_runs / max(1, total_balls)
    g_wr = total_wickets / max(1, total_balls)
    
    venue_stats = df.groupby("venue").agg(
        matches=("match_id", "nunique"), runs=("true_runs", "sum"), 
        wickets=("is_wicket", "sum"), balls=("is_legal", "sum")
    ).reset_index()
    
    venue_stats["run_multiplier"] = 1.0
    venue_stats["wicket_multiplier"] = 1.0
    valid = venue_stats["matches"] >= min_matches
    
    if valid.sum() > 0:
        v_rr = venue_stats.loc[valid, "runs"] / np.maximum(1, venue_stats.loc[valid, "balls"])
        v_wr = venue_stats.loc[valid, "wickets"] / np.maximum(1, venue_stats.loc[valid, "balls"])
        venue_stats.loc[valid, "run_multiplier"] = (v_rr / g_rr).clip(0.5, 2.0)
        venue_stats.loc[valid, "wicket_multiplier"] = (v_wr / g_wr).clip(0.5, 2.0)
        
    return venue_stats[["venue", "matches", "run_multiplier", "wicket_multiplier"]]

def build_over_physics(df: pd.DataFrame, fmt: str) -> Dict:
    """Builds Innings-Aware Per-Over Physics (normalized to exact 1.0)."""
    log.info(f"📊 [{fmt}] Building Innings-Aware Per-Over Physics Buckets (Exact 1.0 Sum)...")
    physics = {}
    valid_balls = df[df["is_legal"] == True]
    
    for (inn, over), group in valid_balls.groupby(["innings_no", "over_no"]):
        w_rate = float(group["is_wicket"].mean())
        run_counts = group["true_runs"].value_counts(normalize=True).to_dict()
        runs_dist = {r: run_counts.get(r, 0.0) for r in range(7)}
        
        # EXACT 1.0 NORMALIZATION
        total = w_rate + sum(runs_dist.values())
        if total > 0:
            w_rate /= total
            runs_dist = {k: v/total for k, v in runs_dist.items()}
        else:
            runs_dist[0] = 1.0
            w_rate = 0.0
            
        physics[f"{inn}_{over}"] = {"wicket_rate": w_rate, "run_dist": runs_dist}
        
    return physics

def build_mc_matrix_table(physics: Dict, fmt: str, iters: int = 10000) -> Dict:
    """Builds a Step-1 Matrix Grid for all states in ~5 mins using Spreadsheet batching."""
    log.info(f"🎲 [{fmt}] Building Vectorized Step-1 MC Matrix Grid (Fast Spreadsheet Method)...")
    table = {}
    max_balls = 120 if fmt == "T20" else 300
    max_runs = 250 if fmt == "T20" else 400
    phases = ["powerplay", "middle", "death"] if fmt == "T20" else ["p1", "p2", "p3"]
    
    # Average physics per phase for the base table
    phase_phys = {}
    for ph in phases:
        ph_keys = []
        if ph == "powerplay": ph_keys = [f"2_{i}" for i in range(6)]
        elif ph == "middle": ph_keys = [f"2_{i}" for i in range(6, 15)]
        elif ph == "death": ph_keys = [f"2_{i}" for i in range(15, 20)]
        elif ph == "p1": ph_keys = [f"2_{i}" for i in range(10)]
        elif ph == "p2": ph_keys = [f"2_{i}" for i in range(10, 40)]
        else: ph_keys = [f"2_{i}" for i in range(40, 50)]
        
        valid_keys = [k for k in ph_keys if k in physics]
        if not valid_keys: valid_keys = list(physics.keys())
        w_r = np.mean([physics[k]["wicket_rate"] for k in valid_keys])
        r_d = {r: np.mean([physics[k]["run_dist"][r] for k in valid_keys]) for r in range(7)}
        tot = w_r + sum(r_d.values())
        if tot > 0:
            phase_phys[ph] = (w_r/tot, np.array([r_d[r]/tot for r in range(7)]))
        else:
            phase_phys[ph] = (0.0, np.array([1.0, 0, 0, 0, 0, 0, 0]))
            
    rng = np.random.default_rng(SEED)
    
    with tqdm(total=10 * len(phases), desc="Matrix Grid", leave=False) as pbar:
        for wkts_left in range(1, 11):
            for ph in phases:
                w_prob, run_probs = phase_phys[ph]
                runs_scored = np.zeros(iters, dtype=np.int32)
                w_left = np.full(iters, wkts_left, dtype=np.int32)
                alive = np.ones(iters, dtype=bool)
                
                # Pre-generate random outcomes for speed
                ball_runs = rng.choice(7, p=run_probs, size=(max_balls, iters))
                is_out = rng.random((max_balls, iters)) < w_prob
                
                # Base case (0 balls rem)
                for rn in range(1, max_runs + 1):
                    table[(rn, 0, wkts_left, ph)] = 0.0
                
                for b_idx in range(max_balls):
                    balls_rem = b_idx + 1
                    if alive.any():
                        runs_scored += np.where(alive, ball_runs[b_idx], 0)
                        w_left -= (is_out[b_idx] & alive).astype(np.int32)
                        alive = alive & (w_left > 0)
                    
                    # Super-fast exact win prob for all run targets at once using bincount cumulative
                    counts = np.bincount(np.clip(runs_scored, 0, max_runs), minlength=max_runs+1)
                    successes = np.cumsum(counts[::-1])[::-1]
                    for rn in range(1, max_runs + 1):
                        table[(rn, balls_rem, wkts_left, ph)] = float(successes[rn] / iters)
                        
                pbar.update(1)
                
    return table

def lookup_mc_probs(df: pd.DataFrame, table: Dict, venue_dna: pd.DataFrame) -> np.ndarray:
    log.info("🎲 Performing O(1) Matrix Lookups (with Stadium DNA adjustments)...")
    v_dict = venue_dna.set_index("venue").to_dict(orient="index")
    
    probs = []
    for _, row in df.iterrows():
        ven = row["venue"]
        r_mult = v_dict.get(ven, {}).get("run_multiplier", 1.0)
        
        # Neutral Adjustment to runs_needed based on stadium DNA
        rn_base = float(row["runs_needed"])
        rn = int(rn_base / r_mult) if r_mult > 0 else int(rn_base)
        rn = max(1, rn)
        
        br = int(row["balls_remaining"])
        wl = int(row["wickets_left"])
        ph = str(row["phase"]).lower()
        inn = int(row["innings_no"])
        
        if br <= 0 or wl <= 0: p = 0.0
        elif rn <= 0: p = 1.0
        else:
            rn_snap = min(rn, 400 if "p" in ph else 250)
            br_snap = min(br, 300 if "p" in ph else 120)
            wl_snap = min(10, max(1, wl))
            p = table.get((rn_snap, br_snap, wl_snap, ph), 0.5)
            
        probs.append(p)
        
    return np.array(probs)

# ============================================================
# 5. UNIFIED ENGINE (V15 ZERO-ERROR EDITION)
# ============================================================
class CrinavaUnified:
    def __init__(self, out_dir: str):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.audit_dir = self.out_dir / "crinava_audit"
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        
        log.info("🧹 Cleaning old outputs from workspace...")
        for pattern in ["t20_*", "odi_*"]:
            for f in self.out_dir.glob(pattern):
                try: f.unlink()
                except: pass
        self.env = {}

    def load_and_verify(self, paths: Dict[str, str]) -> pd.DataFrame:
        log.info(f"{'='*50}\n[1] DATA INGESTION & INTEGRITY\n{'='*50}")
        frames = []
        for fmt, path in paths.items():
            p_obj = Path(path)
            if not p_obj.exists(): continue
            for fpath in tqdm(list(p_obj.glob("*.csv")), desc=f"Ingesting {fmt} CSVs"):
                try:
                    df = pd.read_csv(fpath, low_memory=False)
                    if any(c not in df.columns for c in REQUIRED_COLS): continue
                    
                    df["true_runs"] = df["runs_total"].fillna(0).astype(np.int16)
                    df["is_wicket"] = df["wicket_kind"].notna().astype(np.int8)
                    df["is_legal"] = df["extras_type_raw"].apply(_is_legal_delivery)
                    
                    # 🕒 Extract Year for Smart Par
                    if "match_date" in df.columns:
                        df["year"] = pd.to_datetime(df["match_date"], errors='coerce').dt.year.fillna(2020).astype(int)
                    else:
                        df["year"] = 2020
                        
                    totals = df.groupby(['match_id', 'innings_no'])['true_runs'].sum().unstack(fill_value=0)
                    if 1 not in totals.columns or 2 not in totals.columns: continue
                    valid = totals[(totals[1] > 0) & (totals[2] > 0)].index
                    if len(valid) == 0: continue
                    
                    df_v = df[df["match_id"].isin(valid) & df["innings_no"].isin([1, 2])].copy()
                    df_v = df_v.sort_values(["match_id", "innings_no", "over_no", "ball_no"]).reset_index(drop=True)
                    
                    if "batting_team" not in df_v.columns: df_v["batting_team"] = "Unknown"
                    if "bowling_team" not in df_v.columns: df_v["bowling_team"] = "Unknown"
                    if "venue" not in df_v.columns: df_v["venue"] = "Unknown"
                    
                    df_v["fmt"] = fmt
                    frames.append(df_v)
                except Exception: continue
        
        if not frames: return pd.DataFrame()
        final_df = pd.concat(frames, ignore_index=True)
        flush_log(f"📊 Total Rows Merged: {len(final_df):,}")
        
        # Smart Par & Target Setup
        for fmt in ["T20", "ODI"]:
            mask = final_df["fmt"] == fmt
            flush_log(f"👻 [{fmt}] Calculating Smart Par (Venue-Year Context)...")
            par_df, global_par = calculate_smart_par(final_df[mask], fmt)
            par_dict = par_df.set_index(["venue", "year"])["par_score"].to_dict()
            # 📊 Live Progress Bar for Smart Par Mapping
            final_df.loc[mask, "smart_par"] = final_df[mask].progress_apply(lambda r: par_dict.get((r["venue"], r["year"]), global_par), axis=1)
            par_df.to_csv(self.audit_dir / f"{fmt.lower()}_venue_year_pars.csv", index=False)
            
        flush_log("🎯 Mapping Global Targets & Match Outcomes...")
        totals = final_df.groupby(['match_id', 'innings_no'])['true_runs'].sum().unstack(fill_value=0)
        final_df["target"] = np.where(final_df["innings_no"] == 1, final_df["smart_par"], final_df["match_id"].map((totals[1] + 1).to_dict()))
        final_df["innings2_won"] = final_df["match_id"].map((totals[2] >= totals[1] + 1).astype(int).to_dict())
        
        flush_log("📈 Building Live Match State (Runs, Wickets, Balls)...")
        gb = final_df.groupby(["match_id", "innings_no"])
        final_df["cumulative_runs"] = gb["true_runs"].cumsum()
        final_df["cumulative_wkts"] = gb["is_wicket"].cumsum()
        final_df["legal_balls_bowled"] = gb["is_legal"].cumsum()
        
        flush_log("⚡ Calculating Requirements (RRR, CRR, Remaining)...")
        max_b = np.where(final_df["fmt"] == "T20", 120, 300)
        final_df["balls_remaining"] = (max_b - final_df["legal_balls_bowled"]).clip(0)
        final_df["runs_needed"] = (final_df["target"] - final_df["cumulative_runs"]).clip(0)
        final_df["wickets_left"] = (10 - final_df["cumulative_wkts"]).clip(0)
        
        b_rem = final_df["balls_remaining"] / 6.0
        b_done = final_df["legal_balls_bowled"] / 6.0
        final_df["rrr"] = np.where(b_rem > 0, final_df["runs_needed"] / b_rem, 99.0)
        final_df["crr"] = np.where(b_done > 0, final_df["cumulative_runs"] / b_done, 0.0)
        
        flush_log("🎭 Annotating Phases & Partnership Momentum...")
        # 📊 Live Progress Bar for Match Phases
        final_df["phase"] = final_df.progress_apply(lambda r: _get_phase(int(r["legal_balls_bowled"]), r["fmt"]), axis=1)
        final_df["partnership_runs"] = final_df.groupby(["match_id", "innings_no", "cumulative_wkts"])["true_runs"].cumsum()
        final_df["partnership_wickets"] = final_df["cumulative_wkts"]
        
        flush_log("🧬 Calculating Rolling Metrics (Last 6 Balls)...")
        final_df["roll6_runs"] = gb["true_runs"].rolling(6, min_periods=1).sum().reset_index(level=[0,1], drop=True)
        final_df["roll6_wkts"] = gb["is_wicket"].rolling(6, min_periods=1).sum().reset_index(level=[0,1], drop=True)
        
        flush_log("✅ Data Load & Logic Verify Complete.")
        return final_df

    def _encode_categoricals(self, df: pd.DataFrame, fmt: str, fit: bool = False) -> pd.DataFrame:
        df = df.copy()
        pbar = tqdm(CATEGORICAL_COLS, desc=f"🛡️ {fmt} Encoding", leave=True, file=sys.stdout)
        for col in pbar:
            pbar.set_description(f"   - {fmt} {col}")
            df[col] = df[col].astype(str).fillna("unknown")
            if fit: 
                le = LabelEncoder()
                le.fit(list(df[col].unique()) + ["unknown"])
                self.env[fmt]["encoders"][col] = le
            le = self.env[fmt]["encoders"].get(col)
            # 🛡️ THE LIGHTGBM FIX: Strict integer cast, absolutely no pd.Categorical used.
            df[col + "_enc"] = le.transform(df[col].apply(lambda v: v if v in le.classes_ else "unknown")).astype(np.int64)
        return df

    def _get_prob_matrix(self, df: pd.DataFrame, fmt: str) -> np.ndarray:
        df = df.reset_index(drop=True)
        m = self.env[fmt]["models"]
        
        # 100% Integer-Based Dataset for Tree Models
        df_tree = df[ALL_FEATURES].fillna(0).copy()
        for c in CATEGORICAL_ENC: df_tree[c] = df_tree[c].astype(np.int64)
            
        p_cb = m["cb"].predict_proba(df_tree[CATBOOST_FEATURES])[:, 1]
        p_xgb = m["xgb"].predict(xgb.DMatrix(df_tree))
        p_lgb = m["lgb"].predict(df_tree)
        p_rf = m["rf"].predict_proba(df_tree)[:, 1]
        p_lr = m["lr"].predict_proba(df_tree)[:, 1]
        
        p_mc = lookup_mc_probs(df, self.env[fmt]["mc_table"], self.env[fmt]["venue_dna"])
        # Direct Innings 1 Math
        p_mc = np.where(df["innings_no"] == 1, 1.0 - p_mc, p_mc)
        
        p_ls = np.full(len(df), 0.5)
        scaler = self.env[fmt]["lstm_scaler"]
        l_num = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
        lstm_m = m["lstm"].eval().to(LSTM_DEVICE)
        
        for _, mdf in tqdm(df.groupby(["match_id", "innings_no"], sort=False), desc=f"LSTM Inference {fmt}", leave=False, file=sys.stdout):
            n_d = scaler.transform(mdf[l_num].fillna(0))
            c_d = mdf[["phase_enc"]].fillna(0).values.astype(np.float32)
            data = np.hstack([n_d, c_d])
            seqs = []
            for i in range(len(data)):
                win = data[max(0, i-SEQ_LENGTH+1) : i+1]
                if len(win) < SEQ_LENGTH: win = np.vstack([np.zeros((SEQ_LENGTH-len(win), data.shape[1])), win])
                seqs.append(win)
            with torch.no_grad():
                # 🛡️ HYBRID SAFE: Ensure data is on LSTM_DEVICE (CPU)
                batch = torch.tensor(np.array(seqs), dtype=torch.float32).to(LSTM_DEVICE)
                p_ls[mdf.index] = lstm_m(batch).cpu().numpy().ravel()
            sys.stdout.flush()
            
        clear_memory()
        return np.column_stack([p_cb, p_xgb, p_lgb, p_rf, p_lr, p_mc, p_ls])

    def _build_lstm_sequences(self, df_sub: pd.DataFrame, scaler, l_num: List[str]) -> Tuple[np.ndarray, np.ndarray]:
        xs, ys = [], []
        for _, mdf in tqdm(df_sub.groupby(["match_id", "innings_no"], sort=False), desc="Building LSTM Seqs", leave=False):
            n_d = scaler.transform(mdf[l_num].fillna(0))
            c_d = mdf[["phase_enc"]].fillna(0).values.astype(np.float32)
            data = np.hstack([n_d, c_d])
            lbl = int(mdf["innings2_won"].iloc[0])
            if len(data) >= SEQ_LENGTH:
                for i in range(len(data)-SEQ_LENGTH+1): 
                    xs.append(data[i:i+SEQ_LENGTH])
                    ys.append(lbl)
        return np.array(xs), np.array(ys)

    def _train_base_models(self, tr_df: pd.DataFrame, vl_df: pd.DataFrame, fmt: str):
        log.info(f"🧠 Training Council of Experts ({fmt})...")
        
        log.info(f"   [1/6] Training CatBoost...")
        d_cb = tr_df[CATBOOST_FEATURES].copy()
        for c in CATEGORICAL_ENC: d_cb[c] = d_cb[c].astype(np.int64)
        self.env[fmt]["models"]["cb"] = CatBoostClassifier(iterations=400, depth=6, verbose=0, cat_features=CATEGORICAL_ENC).fit(d_cb, tr_df["innings2_won"])
        clear_memory()
        
        log.info(f"   [2/6] Training XGBoost & LightGBM (100% Crash-Proof)...")
        d_tree = tr_df[ALL_FEATURES].fillna(0).copy()
        for c in CATEGORICAL_ENC: d_tree[c] = d_tree[c].astype(np.int64)
        
        self.env[fmt]["models"]["xgb"] = xgb.train({"objective":"binary:logistic","seed":SEED}, xgb.DMatrix(d_tree, label=tr_df["innings2_won"]), num_boost_round=200)
        self.env[fmt]["models"]["lgb"] = lgb.train({"objective":"binary","metric":"auc","verbose":-1,"seed":SEED}, lgb.Dataset(d_tree, label=tr_df["innings2_won"]), num_boost_round=200)
        clear_memory()
        
        log.info(f"   [3/6] Training Random Forest...")
        self.env[fmt]["models"]["rf"] = RandomForestClassifier(n_estimators=100, max_depth=10, n_jobs=-1, random_state=SEED).fit(d_tree, tr_df["innings2_won"])
        clear_memory()
        
        log.info(f"   [4/6] Training Logistic Regression...")
        self.env[fmt]["models"]["lr"] = LogisticRegression(max_iter=1000).fit(d_tree, tr_df["innings2_won"])
        
        log.info(f"🌊 Training Deep LSTM ({fmt}) on CPU (Hybrid Mode)...")
        lstm = CrinavaLSTM(input_dim=12).to(LSTM_DEVICE)
        sc = self.env[fmt]["lstm_scaler"]
        l_num = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
        sc.fit(tr_df[l_num].fillna(0))
        
        m_ids_tr = tr_df["match_id"].unique()
        if len(m_ids_tr) > MAX_MATCHES_LSTM: m_ids_tr = m_ids_tr[-MAX_MATCHES_LSTM:]
        tx, ty = self._build_lstm_sequences(tr_df[tr_df["match_id"].isin(m_ids_tr)], sc, l_num)
        
        m_ids_vl = vl_df["match_id"].unique()
        if len(m_ids_vl) > MAX_VAL_MATCHES_LSTM: m_ids_vl = m_ids_vl[-MAX_VAL_MATCHES_LSTM:]
        vx, vy = self._build_lstm_sequences(vl_df[vl_df["match_id"].isin(m_ids_vl)], sc, l_num)
        
        if len(tx) > 0 and len(vx) > 0:
            tr_ldr = DataLoader(MomentumDataset(tx, ty), batch_size=BATCH_SIZE, shuffle=True, drop_last=True)
            vl_ldr = DataLoader(MomentumDataset(vx, vy), batch_size=BATCH_SIZE, shuffle=False)
            
            opt = torch.optim.Adam(lstm.parameters(), lr=1e-3)
            crit = nn.BCELoss()
            scheduler = ReduceLROnPlateau(opt, mode='min', factor=0.5, patience=2)
            
            best_val_loss = float('inf')
            best_state = None
            patience_cnt = 0
            
            with tqdm(total=LSTM_EPOCHS, desc=f"LSTM Epochs {fmt}") as pbar:
                for epoch in range(LSTM_EPOCHS):
                    lstm.train()
                    for xb, yb in tr_ldr:
                        xb, yb = xb.to(LSTM_DEVICE), yb.to(LSTM_DEVICE).unsqueeze(1)
                        opt.zero_grad()
                        loss = crit(lstm(xb), yb)
                        if torch.isnan(loss): continue
                        loss.backward()
                        nn.utils.clip_grad_norm_(lstm.parameters(), 1.0)
                        opt.step()
                    
                    lstm.eval()
                    val_loss = 0.0
                    with torch.no_grad():
                        for xb, yb in vl_ldr:
                            xb, yb = xb.to(LSTM_DEVICE), yb.to(LSTM_DEVICE).unsqueeze(1)
                            val_loss += crit(lstm(xb), yb).item()
                    val_loss /= len(vl_ldr)
                    
                    scheduler.step(val_loss)
                    if val_loss < best_val_loss:
                        best_val_loss = val_loss
                        best_state = lstm.state_dict()
                        patience_cnt = 0
                    else:
                        patience_cnt += 1
                        
                    pbar.set_postfix({"loss": f"{val_loss:.4f}"})
                    pbar.update(1)
                    if patience_cnt >= LSTM_PATIENCE: break
            if best_state is not None: lstm.load_state_dict(best_state)
                
        self.env[fmt]["models"]["lstm"] = lstm.eval()
        clear_memory()

    def _generate_wpa_outputs(self, tr_d: pd.DataFrame, vl_d: pd.DataFrame, ts_d: pd.DataFrame, fmt: str, report: str):
        log.info(f"🎁 Generating Final {fmt} Master Files (CSV + JSON) & Audit Logs...")
        
        # OOF Predictions using stable integer tree
        tr_d["wp_after"] = 50.0
        kf = KFold(n_splits=3, shuffle=True, random_state=SEED)
        m_ids_tr = tr_d["match_id"].unique()
        
        d_tree = tr_d[ALL_FEATURES].fillna(0).copy()
        for c in CATEGORICAL_ENC: d_tree[c] = d_tree[c].astype(np.int64)
        
        for tr_idx, val_idx in tqdm(kf.split(m_ids_tr), total=3, desc=f"OOF Verification {fmt}", leave=False):
            t_m, v_m = m_ids_tr[tr_idx], m_ids_tr[val_idx]
            t_df = d_tree[tr_d["match_id"].isin(t_m)]
            v_df = d_tree[tr_d["match_id"].isin(v_m)]
            
            tmp_rf = RandomForestClassifier(n_estimators=50, max_depth=8, random_state=SEED)
            tmp_rf.fit(t_df, tr_d[tr_d["match_id"].isin(t_m)]["innings2_won"])
            
            idx = tr_d[tr_d["match_id"].isin(v_m)].index
            tr_d.loc[idx, "wp_after"] = (tmp_rf.predict_proba(v_df)[:, 1] * 100).round(2)
            del tmp_rf; clear_memory()
            
        # Compile complete DB
        all_wpa = pd.concat([tr_d, vl_d, ts_d]).sort_values(["match_id", "innings_no", "over_no", "ball_no"])
        
        # WPA DELTA RESET (Clean Innings Boundaries)
        all_wpa["wpa_delta"] = all_wpa.groupby(["match_id", "innings_no"])["wp_after"].diff().fillna(0).round(2)
        all_wpa["pressure_score"] = (all_wpa["wpa_delta"].abs() * 10).clip(0, 100).round(1)
        
        out_cols = [
            "match_id", "innings_no", "over_no", "ball_no", "batting_team", "bowling_team", "venue",
            "batting_id", "bowling_id",
            "runs_total", "wickets_left", "balls_remaining", "runs_needed", "rrr", "crr",
            "is_wicket", "wp_after", "wpa_delta", "pressure_score"
        ]
        
        for col in ["batting_id", "bowling_id"]:
            if col not in all_wpa.columns:
                all_wpa[col] = "Unknown"
        
        def save_dual(df_to_save, path_stem):
            df_to_save.to_csv(f"{path_stem}.csv", index=False)
            df_to_save.to_pickle(f"{path_stem}.pkl")
            log.info(f"💾 Saved twin files: {Path(path_stem).name}.csv/.pkl")

        # ==========================================
        # 📂 THE DOUBLE-FORMAT "TOP 3" CREATION
        # ==========================================
        # 1. Historical WPA (Insight)
        save_dual(all_wpa[out_cols], self.out_dir / f"{fmt.lower()}_historical_wpa")
        all_wpa[out_cols].to_json(self.out_dir / f"{fmt.lower()}_historical_wpa.json", orient="records")
        
        # 2. Prematch (Simulator)
        prematch_data = {"over_physics": self.env[fmt]["physics"], "metadata": {"iterations": 10000, "version": "v15"}}
        with open(self.out_dir / f"{fmt.lower()}_prematch.json", "w") as fh: json.dump(prematch_data, fh)
        phys_df = pd.DataFrame([{"over_key": k, "wicket_rate": v["wicket_rate"], **v["run_dist"]} for k, v in self.env[fmt]["physics"].items()])
        save_dual(phys_df, self.out_dir / f"{fmt.lower()}_prematch")
        
        # 3. Live Engine (Website Brain)
        sc = self.env[fmt]["lstm_scaler"]
        live_data = {
            "weights": self.env[fmt]["weights"].tolist(), "models": ["cb", "xgb", "lgb", "rf", "lr", "mc", "lstm"],
            "encoders": {c: le.classes_.tolist() for c, le in self.env[fmt]["encoders"].items()},
            "scaler": {"mean": sc.mean_.tolist(), "scale": sc.scale_.tolist()}
        }
        with open(self.out_dir / f"{fmt.lower()}_live_engine.json", "w") as fh: json.dump(live_data, fh)
        live_csv = pd.DataFrame({"model": live_data["models"], "weight": live_data["weights"]})
        save_dual(live_csv, self.out_dir / f"{fmt.lower()}_live_engine")
        
        pre = fmt.lower()
        with open(self.out_dir / f"{pre}_encoders.pkl", 'wb') as f: pickle.dump(self.env[fmt]["encoders"], f)
        with open(self.out_dir / f"{pre}_scaler.pkl", 'wb') as f: pickle.dump(self.env[fmt]["lstm_scaler"], f)
        
        # ==========================================
        # 📂 THE AUDIT FOLDER (Transparency)
        # ==========================================
        test_wpa = all_wpa[all_wpa["match_id"].isin(ts_d["match_id"].unique())]
        save_dual(test_wpa[out_cols], self.audit_dir / f"{fmt.lower()}_test_match_predictions")
        save_dual(self.env[fmt]["venue_dna"], self.audit_dir / f"{fmt.lower()}_stadium_master_dna")
        save_dual(phys_df, self.audit_dir / f"{fmt.lower()}_over_by_over_physics_normalized")
        
        # Individual Model Stats
        model_stats = pd.DataFrame({
            "Model": ["CatBoost", "XGBoost", "LightGBM", "RandomForest", "LogReg", "MonteCarlo", "LSTM"],
            "Weight": self.env[fmt]["weights"],
            "AUC_Test": [roc_auc_score(ts_d["innings2_won"], ts_d[f"p_{m}"]) if len(np.unique(ts_d["innings2_won"])) > 1 else 0.5 for m in ["cb", "xgb", "lgb", "rf", "lr", "mc", "ls"]],
            "Accuracy_Test": [accuracy_score(ts_d["innings2_won"], (ts_d[f"p_{m}"] > 0.5).astype(int)) for m in ["cb", "xgb", "lgb", "rf", "lr", "mc", "ls"]]
        })
        save_dual(model_stats, self.audit_dir / f"{fmt.lower()}_individual_model_stats")
        
        # Prediction Debate Sample
        sample_cols = ["match_id", "innings_no", "over_no", "ball_no", "runs_needed", "balls_remaining", "innings2_won"] + [f"p_{m}" for m in ["cb", "xgb", "lgb", "rf", "lr", "mc", "ls"]] + ["wp_after"]
        debate_sample = ts_d.sample(min(100, len(ts_d)), random_state=SEED)[sample_cols]
        save_dual(debate_sample, self.audit_dir / f"{fmt.lower()}_prediction_debate_sample")
        
        with open(self.audit_dir / f"{fmt.lower()}_expert_weights_audit.txt", "w") as fh: fh.write(report)
        
        log.info(f"✅ Top 3 files + Audit Folder generated for {fmt}.")

    def process_format(self, full_df: pd.DataFrame, fmt: str):
        try:
            log.info(f"\n{'='*50}\n🚀 {fmt} PIPELINE INITIATED\n{'='*50}")
            f_df = full_df[full_df["fmt"] == fmt].copy().sort_values(["match_id", "innings_no", "over_no", "ball_no"]).reset_index(drop=True)
            if f_df.empty: return
                
            self.env[fmt] = {"models": {}, "encoders": {}, "physics": {}, "venue_dna": pd.DataFrame(), "mc_table": {}, "weights": None, "lstm_scaler": StandardScaler()}
            
            # Extract DNA Physics & BUILD MC TABLE FIRST
            self.env[fmt]["physics"] = build_over_physics(f_df, fmt)
            self.env[fmt]["venue_dna"] = calculate_twin_multipliers(f_df, fmt, min_matches=5)
            self.env[fmt]["mc_table"] = build_mc_matrix_table(self.env[fmt]["physics"], fmt)
            
            m_ids = f_df["match_id"].unique()
            total_matches = len(m_ids)
            log.info(f"🛡️ Applying the 1-1-1 Protection Rule for Venues...")
            
            tr_m, vl_m, ts_m, pool = [], [], [], []
            venue_groups = f_df.groupby('venue')['match_id'].unique()
            
            for venue, matches in venue_groups.items():
                np.random.shuffle(matches)
                if len(matches) <= 2:
                    tr_m.extend(matches)
                else:
                    tr_m.append(matches[0])
                    vl_m.append(matches[1])
                    ts_m.append(matches[2])
                    pool.extend(matches[3:])
            
            np.random.shuffle(pool)
            target_tr = int(total_matches * TRAIN_SPLIT_RATIO)
            target_vl = int(total_matches * VAL_SPLIT_RATIO)
            
            for m in pool:
                if len(tr_m) < target_tr: tr_m.append(m)
                elif len(vl_m) < target_vl: vl_m.append(m)
                else: ts_m.append(m)
            
            tr_b = f_df[f_df["match_id"].isin(tr_m)].copy()
            vl_b = f_df[f_df["match_id"].isin(vl_m)].copy()
            ts_b = f_df[f_df["match_id"].isin(ts_m)].copy()
            
            flush_log(f"📈 [{fmt}] Smart Split | Train: {len(tr_m)} | Val: {len(vl_m)} | Test: {len(ts_m)}")
            
            flush_log(f"🛡️ [{fmt}] Encoding Categorical Data (Crash Prevention)...")
            tr_d = self._encode_categoricals(tr_b, fmt, fit=True)
            vl_d = self._encode_categoricals(vl_b, fmt, fit=False)
            ts_d = self._encode_categoricals(ts_b, fmt, fit=False)
            
            self._train_base_models(tr_d, vl_d, fmt)
            
            log.info(f"⚖️ Learning Council Weights using Ridge Regression (No Hardcoding)...")
            p_m_val = self._get_prob_matrix(vl_d, fmt)
            ridge = Ridge(alpha=1e-3, positive=True, fit_intercept=False)
            ridge.fit(p_m_val, vl_d["innings2_won"])
            w = ridge.coef_.ravel().clip(min=0)
            self.env[fmt]["weights"] = w / w.sum() if w.sum() > 0 else np.ones(7)/7
            vl_d["wp_after"] = (p_m_val @ self.env[fmt]["weights"] * 100).round(2)
            
            log.info(f"💾 Saving {fmt} Models...")
            pre, m = fmt.lower(), self.env[fmt]["models"]
            m["cb"].save_model(str(self.out_dir / f"{pre}_catboost.cbm"))
            m["xgb"].save_model(str(self.out_dir / f"{pre}_xgboost.json"))
            m["lgb"].save_model(str(self.out_dir / f"{pre}_lightgbm.txt"))
            with open(self.out_dir / f"{pre}_rf.pkl", 'wb') as f: pickle.dump(m["rf"], f)
            with open(self.out_dir / f"{pre}_logreg.pkl", 'wb') as f: pickle.dump(m["lr"], f)
            torch.save(m["lstm"].state_dict(), self.out_dir / f"{pre}_lstm.pt")
            
            log.info(f"📊 Running Evaluation on Unseen Test Set ({fmt})...")
            p_m_test = self._get_prob_matrix(ts_d, fmt)
            
            model_names = ["cb", "xgb", "lgb", "rf", "lr", "mc", "ls"]
            for i, m_name in enumerate(model_names):
                ts_d[f"p_{m_name}"] = p_m_test[:, i]
                
            ens_p = p_m_test @ self.env[fmt]["weights"]
            ts_d["wp_after"] = (ens_p * 100).round(2)
            y_t = ts_d["innings2_won"].values
            try: auc = roc_auc_score(y_t, ens_p)
            except: auc = 0.5
            
            names = ["CatBoost", "XGBoost", "LightGBM", "RandomForest", "LogReg", "MonteCarlo", "LSTM"]
            rep = [
                f"=== CRINAVA V15 MASTERPIECE EVALUATION ({fmt}) ===",
                f"Accuracy: {accuracy_score(y_t, (ens_p>0.5).astype(int)):.2%}",
                f"AUC:      {auc:.4f}",
                f"Brier:    {brier_score_loss(y_t, ens_p):.4f}",
                "\n--- COUNCIL WEIGHTS ---"
            ]
            for n, weight in zip(names, self.env[fmt]["weights"]):
                rep.append(f"{n:15s}: {weight:.2%}")
            
            self._generate_wpa_outputs(tr_d, vl_d, ts_d, fmt, "\n".join(rep))
            del self.env[fmt]
            clear_memory()
            
        except Exception as e:
            log.error(f"❌ {fmt} Pipeline FAILED. Error:\n{traceback.format_exc()}")
            raise

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--t20_path", type=str, default="/kaggle/input/datasets/jatin2645/white-ball-data/20_overs-20260429T154750Z-3-001/20_overs")
    parser.add_argument("--odi_path", type=str, default="/kaggle/input/datasets/jatin2645/white-ball-data/50_overs-20260429T154750Z-3-001/50_overs")
    parser.add_argument("--out_dir", type=str, default="/kaggle/working/")
    
    if hasattr(sys, 'ps1') or 'JUPYTER' in os.environ or 'ipykernel' in sys.modules:
        args = parser.parse_args([])
    else:
        args = parser.parse_args()
        
    # 🚀 STARTUP BANNER
    print("\n" + "="*70, flush=True)
    print("🚀 CRINAVA V15 MASTERPIECE - INITIATING ENGINE", flush=True)
    print("="*70, flush=True)
    print(f"Device: {DEVICE}", flush=True)
    print(f"Time:   {pd.Timestamp.now().strftime('%H:%M:%S')}", flush=True)
    
    # 🔍 PATH VERIFICATION
    PATHS = {"T20": args.t20_path, "ODI": args.odi_path}
    print("\n🔍 VERIFYING DATA PATHS...", flush=True)
    for fmt, path in PATHS.items():
        p = Path(path)
        if p.exists():
            csv_count = len(list(p.glob("*.csv")))
            print(f"✅ {fmt:3s}: {csv_count:,} files found at {path}", flush=True)
        else:
            print(f"❌ {fmt:3s}: PATH NOT FOUND: {path}", flush=True)
    sys.stdout.flush()

    engine = CrinavaUnified(out_dir=args.out_dir)
    df = engine.load_and_verify(PATHS)
    
    if not df.empty:
        for fmt in ["T20", "ODI"]: 
            engine.process_format(df, fmt)
        print("\n" + "="*60, flush=True)
        print("✅ CRINAVA V15 MASTERPIECE COMPLETE.", flush=True)
        print("="*60, flush=True)
    else: 
        log.error("❌ No valid data loaded. Pipeline terminated.")
    sys.stdout.flush()
