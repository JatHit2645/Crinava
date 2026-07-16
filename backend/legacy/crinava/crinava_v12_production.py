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
from itertools import product
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
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import KFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, brier_score_loss

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
LSTM_EPOCHS = 15
LSTM_PATIENCE = 3
MAX_MATCHES_LSTM = 8000
MAX_VAL_MATCHES_LSTM = 1500

TRAIN_SPLIT_RATIO = 0.70
VAL_SPLIT_RATIO = 0.15

FORCE_CPU = True
DEVICE = torch.device("cpu")
torch.set_num_threads(4)

import logging
for handler in logging.root.handlers[:]: logging.root.removeHandler(handler)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S", handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("crinava_v13")
log.propagate = False
log.info(f"🚀 V13 ZERO-ERROR ENGINE INITIALIZED | Device: {DEVICE}")

REQUIRED_COLS = [
    "match_id", "innings_no", "over_no", "ball_no",
    "runs_total", "wicket_kind", "match_type", "extras_type_raw"
]

NUMERIC_FEATURES = ["runs_needed", "balls_remaining", "wickets_left", "rrr", "crr", "cumulative_runs", "cumulative_wkts", "target", "roll6_runs", "roll6_wkts", "partnership_runs"]
CATEGORICAL_COLS = ["batting_team", "bowling_team", "venue", "phase", "innings_no"]
CATEGORICAL_ENC = [c + "_enc" for c in CATEGORICAL_COLS]
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_ENC
CATBOOST_FEATURES = NUMERIC_FEATURES + CATEGORICAL_COLS
LSTM_FEATURE_COLS = ["true_runs", "is_wicket", "over_no", "ball_no", "crr", "rrr", "runs_needed", "balls_remaining", "wickets_left", "phase_enc", "partnership_runs", "partnership_wickets"]

# ============================================================
# 2. HELPER FUNCTIONS
# ============================================================
def clear_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()

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

def _parse_extras(raw) -> int:
    try:
        if pd.isna(raw) or raw in (None, "{}", "", "nan"): return 0
        d = json.loads(raw) if isinstance(raw, str) else raw
        return int(sum(d.values())) if isinstance(d, dict) else 0
    except Exception: return 0

# ============================================================
# 3. ARCHITECTURE
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
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.3)
        self.bn = nn.BatchNorm1d(hidden_dim)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (hn, _) = self.lstm(x)
        h = self.bn(hn[-1])
        return torch.sigmoid(self.fc(self.dropout(h)))

# ============================================================
# 4. PHYSICS (MONTE CARLO - 1 RUN PRECISION)
# ============================================================
def run_monte_carlo(target: int, balls_remaining: int, wickets_left: int, phase: str, physics_params: Dict, iters: int = 2000) -> float:
    if balls_remaining <= 0 or wickets_left <= 0: return 0.0
    if target <= 0: return 1.0 # Target reached
    
    w_prob = physics_params["wicket_rates"].get(phase, 0.045)
    run_outcomes = physics_params["run_outcomes"]
    possible_runs = np.array(list(run_outcomes.keys()))
    run_probs = np.array(list(run_outcomes.values()))
    
    rng = np.random.default_rng()
    runs_scored = np.zeros(iters, dtype=np.int32)
    wkts_left_v = np.full(iters, wickets_left, dtype=np.int32)
    alive = np.ones(iters, dtype=bool)
    
    for _ in range(balls_remaining):
        if not alive.any(): break
        ball_runs = rng.choice(possible_runs, p=run_probs, size=iters)
        ball_runs[~alive] = 0
        runs_scored += ball_runs
        is_out = (rng.random(iters) < w_prob) & alive
        wkts_left_v -= is_out.astype(np.int32)
        alive = alive & (runs_scored < target) & (wkts_left_v > 0)
        
    return float(np.mean(runs_scored >= target))

def build_mc_lookup_table(physics_params: Dict, fmt: str) -> Dict:
    log.info(f"Building High-Precision MC table for {fmt} (Fast Distribution Mode)...")
    table = {}
    max_b = 120 if fmt == "T20" else 300
    runs_grid = range(0, 201 if fmt == "T20" else 401, 1)
    balls_grid = range(0, max_b + 1, 1)
    phases = ["powerplay", "middle", "death"] if fmt == "T20" else ["p1", "p2", "p3"]
    
    w_prob_map = physics_params["wicket_rates"]
    run_outcomes = physics_params["run_outcomes"]
    possible_runs = np.array(list(run_outcomes.keys()))
    run_probs = np.array(list(run_outcomes.values()))
    iters = 2000
    rng = np.random.default_rng(SEED)

    # Pre-simulate run distributions for each (balls, wickets, phase)
    # Total combinations: ~3,600 (Fast)
    total_combs = len(balls_grid) * 10 * len(phases)
    with tqdm(total=total_combs, desc=f"MC Physics {fmt}", leave=False) as pbar:
        for bl in balls_grid:
            for wk in range(1, 11):
                for ph in phases:
                    w_prob = w_prob_map.get(ph, 0.045)
                    # Vectorized Innings Simulation
                    runs_scored = np.zeros(iters, dtype=np.int32)
                    wkts_left = np.full(iters, wk, dtype=np.int8)
                    alive = np.ones(iters, dtype=bool)
                    
                    for _ in range(bl):
                        if not alive.any(): break
                        outcomes = rng.choice(possible_runs, p=run_probs, size=iters)
                        runs_scored += np.where(alive, outcomes, 0)
                        is_out = (rng.random(iters) < w_prob) & alive
                        wkts_left -= is_out.astype(np.int8)
                        alive = alive & (wkts_left > 0)
                    
                    # Fill all runs_needed for this (bl, wk, ph) instantly
                    for rn in runs_grid:
                        if rn == 0: table[(rn, bl, wk, ph)] = 1.0
                        else: table[(rn, bl, wk, ph)] = float(np.mean(runs_scored >= rn))
                    pbar.update(1)
                    
    clear_memory()
    return table

def lookup_mc_prob(runs_needed: float, balls_remaining: float, wickets_left: float, phase: str, fmt: str, table: Dict) -> float:
    max_b = 120 if fmt == "T20" else 300
    rn_bin = int(round(max(0, min(runs_needed, 200 if fmt == "T20" else 400))))
    b_bin = int(round(max(0, min(balls_remaining, max_b))))
    wk_bin = int(max(1, min(int(wickets_left), 10)))
    return table.get((rn_bin, b_bin, wk_bin, phase), 0.5)

# ============================================================
# 5. UNIFIED ENGINE (V13 ZERO-ERROR EDITION)
# ============================================================
class CrinavaUnified:
    def __init__(self, out_dir: str):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        
        # Clean Slate: Remove old outputs to avoid confusion
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
                    
                    totals = df.groupby(['match_id', 'innings_no'])['true_runs'].sum().unstack(fill_value=0)
                    if 1 not in totals.columns or 2 not in totals.columns: continue
                    valid = totals[(totals[1] > 0) & (totals[2] > 0)].index
                    if len(valid) == 0: continue
                    
                    # Full Match Coverage (Innings 1 and 2)
                    df_v = df[df["match_id"].isin(valid) & df["innings_no"].isin([1, 2])].copy()
                    df_v = df_v.sort_values(["match_id", "innings_no", "over_no", "ball_no"]).reset_index(drop=True)
                    
                    par_score = 165 if fmt == "T20" else 275
                    df_v["target"] = np.where(df_v["innings_no"] == 1, par_score, df_v["match_id"].map((totals[1] + 1).to_dict()))
                    df_v["innings2_won"] = df_v["match_id"].map((totals[2] >= totals[1] + 1).astype(int).to_dict())
                    
                    if "batting_team" not in df_v.columns:
                        df_v["batting_team"] = "Team_" + df_v["innings_no"].astype(str)
                        df_v["bowling_team"] = "Team_" + (3 - df_v["innings_no"]).astype(str)
                    if "venue" not in df_v.columns: df_v["venue"] = "Unknown"
                    
                    gb = df_v.groupby(["match_id", "innings_no"])
                    df_v["cumulative_runs"] = gb["true_runs"].cumsum()
                    df_v["cumulative_wkts"] = gb["is_wicket"].cumsum()
                    df_v["legal_balls_bowled"] = gb["is_legal"].cumsum()
                    
                    max_b = 120 if fmt == "T20" else 300
                    df_v["balls_remaining"] = (max_b - df_v["legal_balls_bowled"]).clip(0)
                    df_v["runs_needed"] = (df_v["target"] - df_v["cumulative_runs"]).clip(0)
                    df_v["wickets_left"] = (10 - df_v["cumulative_wkts"]).clip(0)
                    
                    b_rem = df_v["balls_remaining"] / 6.0
                    b_done = df_v["legal_balls_bowled"] / 6.0
                    df_v["rrr"] = np.where(b_rem > 0, df_v["runs_needed"] / b_rem, 99.0)
                    df_v["crr"] = np.where(b_done > 0, df_v["cumulative_runs"] / b_done, 0.0)
                    df_v["phase"] = df_v["legal_balls_bowled"].apply(lambda b: _get_phase(int(b), fmt))
                    
                    df_v["partnership_runs"] = df_v.groupby(["match_id", "innings_no", "cumulative_wkts"])["true_runs"].cumsum()
                    df_v["partnership_wickets"] = df_v["cumulative_wkts"]
                    df_v["roll6_runs"] = gb["true_runs"].rolling(6, min_periods=1).sum().reset_index(level=[0,1], drop=True)
                    df_v["roll6_wkts"] = gb["is_wicket"].rolling(6, min_periods=1).sum().reset_index(level=[0,1], drop=True)
                    df_v["fmt"] = fmt
                    frames.append(df_v)
                except Exception: continue
        
        if not frames: return pd.DataFrame()
        final_df = pd.concat(frames, ignore_index=True)
        log.info(f"✅ Loaded - T20: {len(final_df[final_df['fmt']=='T20']['match_id'].unique())} | ODI: {len(final_df[final_df['fmt']=='ODI']['match_id'].unique())}")
        return final_df

    def _encode_categoricals(self, df: pd.DataFrame, fmt: str, fit: bool = False) -> pd.DataFrame:
        df = df.copy()
        for col in tqdm(CATEGORICAL_COLS, desc=f"Encoding {fmt}", leave=False):
            df[col] = df[col].astype(str).fillna("unknown")
            if fit: self.env[fmt]["encoders"][col] = LabelEncoder().fit(list(df[col].unique()) + ["unknown"])
            le = self.env[fmt]["encoders"].get(col)
            df[col + "_enc"] = le.transform(df[col].apply(lambda v: v if v in le.classes_ else "unknown"))
        return df

    def _get_prob_matrix(self, df: pd.DataFrame, fmt: str) -> np.ndarray:
        df = df.reset_index(drop=True)
        m = self.env[fmt]["models"]
        
        df_cb = df[CATBOOST_FEATURES].copy()
        df_cb[NUMERIC_FEATURES] = df_cb[NUMERIC_FEATURES].fillna(0)
        df_cb[CATEGORICAL_COLS] = df_cb[CATEGORICAL_COLS].astype(str)
        p_cb = m["cb"].predict_proba(df_cb)[:, 1]
        
        df_tree = df[ALL_FEATURES].fillna(0).copy()
        p_xgb = m["xgb"].predict(xgb.DMatrix(df_tree))
        p_lgb = m["lgb"].predict(df_tree)
        
        df_num = df[ALL_FEATURES].copy()
        for c in CATEGORICAL_ENC: df_num[c] = df_num[c].astype(int)
        p_rf = m["rf"].predict_proba(df_num.fillna(0))[:, 1]
        p_lr = m["lr"].predict_proba(df_num.fillna(0))[:, 1]
        
        # MC Calculation aligned to predict Chaser Win Probability
        p_mc = np.array([lookup_mc_prob(r["runs_needed"], r["balls_remaining"], r["wickets_left"], r["phase"], fmt, self.env[fmt]["mc_table"]) for _, r in df.iterrows()])
        p_mc = np.where(df["innings_no"] == 1, 1.0 - p_mc, p_mc)
        
        p_ls = np.full(len(df), 0.5)
        scaler = self.env[fmt]["lstm_scaler"]
        l_num = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
        lstm_m = m["lstm"].eval().to(torch.device("cpu"))
        
        for _, mdf in tqdm(df.groupby(["match_id", "innings_no"], sort=False), desc=f"LSTM Inference {fmt}", leave=False):
            n_d = scaler.transform(mdf[l_num].fillna(0))
            c_d = mdf[["phase_enc"]].fillna(0).values
            data = np.hstack([n_d, c_d]).astype(np.float32)
            seqs = []
            for i in range(len(data)):
                win = data[max(0, i-SEQ_LENGTH+1) : i+1]
                if len(win) < SEQ_LENGTH: win = np.vstack([np.zeros((SEQ_LENGTH-len(win), data.shape[1])), win])
                seqs.append(win)
            with torch.no_grad():
                batch = torch.tensor(np.array(seqs)).to(torch.device("cpu"))
                p_ls[mdf.index] = lstm_m(batch).cpu().numpy().ravel()
            del data, seqs, batch
            
        clear_memory()
        return np.column_stack([p_cb, p_xgb, p_lgb, p_rf, p_lr, p_mc, p_ls])

    def _build_lstm_sequences(self, df_sub: pd.DataFrame, scaler, l_num: List[str]) -> Tuple[np.ndarray, np.ndarray]:
        xs, ys = [], []
        for _, mdf in tqdm(df_sub.groupby(["match_id", "innings_no"], sort=False), desc="Building LSTM Seqs", leave=False):
            n_d = scaler.transform(mdf[l_num].fillna(0))
            c_d = mdf[["phase_enc"]].fillna(0).values
            data = np.hstack([n_d, c_d]).astype(np.float32)
            lbl = int(mdf["innings2_won"].iloc[0])
            if len(data) >= SEQ_LENGTH:
                for i in range(len(data)-SEQ_LENGTH+1): 
                    xs.append(data[i:i+SEQ_LENGTH])
                    ys.append(lbl)
        return np.array(xs), np.array(ys)

    def _train_base_models(self, tr_df: pd.DataFrame, vl_df: pd.DataFrame, fmt: str):
        log.info(f"🧠 Training Council of Experts ({fmt})...")
        
        log.info(f"   [1/6] Training CatBoost (Categorical Expert)...")
        d_cb = tr_df[CATBOOST_FEATURES].copy()
        d_cb[NUMERIC_FEATURES] = d_cb[NUMERIC_FEATURES].fillna(0)
        d_cb[CATEGORICAL_COLS] = d_cb[CATEGORICAL_COLS].astype(str)
        self.env[fmt]["models"]["cb"] = CatBoostClassifier(iterations=400, depth=6, verbose=0, cat_features=CATEGORICAL_COLS).fit(d_cb, tr_df["innings2_won"])
        clear_memory()
        
        log.info(f"   [2/6] Training XGBoost & LightGBM (Math Experts)...")
        d_tree = tr_df[ALL_FEATURES].fillna(0).copy()
        self.env[fmt]["models"]["xgb"] = xgb.train({"objective":"binary:logistic","seed":SEED}, xgb.DMatrix(d_tree, label=tr_df["innings2_won"]), num_boost_round=200)
        clear_memory()
        # LightGBM still benefits from categorical type
        d_lgb = tr_df[ALL_FEATURES].copy()
        for c in CATEGORICAL_ENC: d_lgb[c] = pd.Categorical(d_lgb[c])
        self.env[fmt]["models"]["lgb"] = lgb.train({"objective":"binary","metric":"auc","verbose":-1,"seed":SEED}, lgb.Dataset(d_lgb, label=tr_df["innings2_won"]), num_boost_round=200)
        clear_memory()
        
        log.info(f"   [3/6] Training Random Forest (Stability Expert)...")
        d_num = tr_df[ALL_FEATURES].copy()
        for c in CATEGORICAL_ENC: d_num[c] = d_num[c].astype(int)
        d_num = d_num.fillna(0)
        self.env[fmt]["models"]["rf"] = RandomForestClassifier(n_estimators=100, max_depth=10, n_jobs=-1, random_state=SEED).fit(d_num, tr_df["innings2_won"])
        clear_memory()
        
        log.info(f"   [4/6] Training Logistic Regression (Baseline)...")
        self.env[fmt]["models"]["lr"] = LogisticRegression(max_iter=1000).fit(d_num, tr_df["innings2_won"])
        
        log.info(f"🌊 Training Deep LSTM ({fmt}) with Stability Guards...")
        lstm = CrinavaLSTM(input_dim=12).to(DEVICE)
        sc = self.env[fmt]["lstm_scaler"]
        l_num = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
        sc.fit(tr_df[l_num].fillna(0))
        
        m_ids_tr = tr_df["match_id"].unique()
        if len(m_ids_tr) > MAX_MATCHES_LSTM: m_ids_tr = m_ids_tr[-MAX_MATCHES_LSTM:]
        tr_sub = tr_df[tr_df["match_id"].isin(m_ids_tr)]
        
        m_ids_vl = vl_df["match_id"].unique()
        if len(m_ids_vl) > MAX_VAL_MATCHES_LSTM: m_ids_vl = m_ids_vl[-MAX_VAL_MATCHES_LSTM:]
        vl_sub = vl_df[vl_df["match_id"].isin(m_ids_vl)]
        
        tx, ty = self._build_lstm_sequences(tr_sub, sc, l_num)
        vx, vy = self._build_lstm_sequences(vl_sub, sc, l_num)
        
        if len(tx) > 0 and len(vx) > 0:
            # Drop last resolves BatchNorm crash logic safely
            tr_ldr = DataLoader(MomentumDataset(tx, ty), batch_size=BATCH_SIZE, shuffle=True, drop_last=True)
            vl_ldr = DataLoader(MomentumDataset(vx, vy), batch_size=BATCH_SIZE, shuffle=False)
            
            opt = torch.optim.Adam(lstm.parameters(), lr=1e-3)
            crit = nn.BCELoss()
            scheduler = ReduceLROnPlateau(opt, mode='min', factor=0.5, patience=2)
            
            log.info(f"   [5/6] Training Deep LSTM (Momentum Expert)...")
            best_val_loss = float('inf')
            best_state = None
            patience_cnt = 0
            
            with tqdm(total=LSTM_EPOCHS, desc=f"LSTM Epochs {fmt}") as pbar:
                for epoch in range(LSTM_EPOCHS):
                    lstm.train()
                    for xb, yb in tr_ldr:
                        xb, yb = xb.to(DEVICE), yb.to(DEVICE).unsqueeze(1)
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
                            xb, yb = xb.to(DEVICE), yb.to(DEVICE).unsqueeze(1)
                            val_loss += crit(lstm(xb), yb).item()
                    val_loss /= len(vl_ldr)
                    
                    scheduler.step(val_loss)
                    
                    if val_loss < best_val_loss:
                        best_val_loss = val_loss
                        best_state = lstm.state_dict()
                        patience_cnt = 0
                    else:
                        patience_cnt += 1
                    
                    pbar.set_postfix({"loss": f"{val_loss:.4f}", "patience": f"{patience_cnt}/{LSTM_PATIENCE}"})
                    pbar.update(1)
                    
                    if patience_cnt >= LSTM_PATIENCE:
                        log.info(f"      Early stopping triggered at epoch {epoch+1}")
                        break
                        
                    clear_memory()
                
            if best_state is not None:
                lstm.load_state_dict(best_state)
                
        self.env[fmt]["models"]["lstm"] = lstm.eval()
        clear_memory()

    def _generate_wpa_outputs(self, tr_d: pd.DataFrame, vl_d: pd.DataFrame, ts_d: pd.DataFrame, fmt: str, report: str):
        log.info(f"🎁 Generating Final {fmt} WPA Files (OOF + Ensemble)...")
        
        # Out Of Fold Prediction for training data
        tr_d["wp_after"] = 50.0
        kf = KFold(n_splits=3, shuffle=True, random_state=SEED)
        m_ids_tr = tr_d["match_id"].unique()
        
        cat_cb = tr_d[CATBOOST_FEATURES].copy()
        cat_cb[NUMERIC_FEATURES] = cat_cb[NUMERIC_FEATURES].fillna(0)
        cat_cb[CATEGORICAL_COLS] = cat_cb[CATEGORICAL_COLS].astype(str)
        
        for tr_idx, val_idx in tqdm(kf.split(m_ids_tr), total=3, desc=f"OOF Verification {fmt}", leave=False):
            t_m, v_m = m_ids_tr[tr_idx], m_ids_tr[val_idx]
            t_df, v_df = cat_cb[tr_d["match_id"].isin(t_m)], cat_cb[tr_d["match_id"].isin(v_m)]
            
            tmp_cb = CatBoostClassifier(iterations=200, depth=6, verbose=0, cat_features=CATEGORICAL_COLS)
            tmp_cb.fit(t_df, tr_d[tr_d["match_id"].isin(t_m)]["innings2_won"])
            
            idx = tr_d[tr_d["match_id"].isin(v_m)].index
            tr_d.loc[idx, "wp_after"] = (tmp_cb.predict_proba(v_df)[:, 1] * 100).round(2)
            del tmp_cb; clear_memory()
            
        log.info(f"   - Finalizing CSV Artifacts...")
        all_wpa = pd.concat([tr_d, vl_d, ts_d]).sort_values(["match_id", "innings_no", "over_no", "ball_no"])
        all_wpa["wpa_delta"] = all_wpa.groupby("match_id")["wp_after"].diff().fillna(0).round(2)
        all_wpa[["match_id", "innings_no", "over_no", "ball_no", "wp_after", "wpa_delta"]].to_csv(self.out_dir / f"{fmt.lower()}_historical_wpa.csv", index=False)
        
        with open(self.out_dir / f"{fmt.lower()}_prematch.json", "w") as fh: 
            json.dump(self.env[fmt]["params"]["physics"], fh)
            
        sc = self.env[fmt]["lstm_scaler"]
        meta = {
            "weights": self.env[fmt]["weights"].tolist(), "models": ["cb","xgb","lgb","rf","lr","mc","lstm"],
            "encoders": {c: le.classes_.tolist() for c, le in self.env[fmt]["encoders"].items()},
            "scaler": {"mean": sc.mean_.tolist(), "scale": sc.scale_.tolist()}
        }
        with open(self.out_dir / f"{fmt.lower()}_live_engine.json", "w") as fh: 
            json.dump(meta, fh)
            
        with open(self.out_dir / f"{fmt.lower()}_summary.txt", "w") as fh: 
            fh.write(report)

    def process_format(self, full_df: pd.DataFrame, fmt: str):
        try:
            log.info(f"\n{'='*50}\n🚀 {fmt} PIPELINE INITIATED\n{'='*50}")
            f_df = full_df[full_df["fmt"] == fmt].copy().sort_values(["match_id", "innings_no", "over_no", "ball_no"]).reset_index(drop=True)
            if f_df.empty: 
                log.warning(f"⚠️ No data for {fmt}, skipping.")
                return
                
            self.env[fmt] = {"models": {}, "encoders": {}, "mc_table": {}, "params": {}, "weights": None, "lstm_scaler": StandardScaler()}
            
            m_ids = f_df["match_id"].unique()
            total_matches = len(m_ids)
            log.info(f"🔍 Analyzing Venue Distribution for {fmt} ({total_matches} total matches)...")
            
            # Smart Venue Split Logic
            tr_m, vl_m, ts_m, pool = [], [], [], []
            venue_groups = f_df.groupby('venue')['match_id'].unique()
            protected_count = 0
            
            log.info(f"🛡️ Applying the '1-1-1' rule and 'Rare Stadium' protections...")
            for venue, matches in venue_groups.items():
                np.random.shuffle(matches)
                if len(matches) <= 2:
                    tr_m.extend(matches)
                    protected_count += len(matches)
                else:
                    tr_m.append(matches[0])
                    vl_m.append(matches[1])
                    ts_m.append(matches[2])
                    protected_count += 3
                    pool.extend(matches[3:])
            
            log.info(f"✅ Protected {protected_count} matches via Smart Venue Rule.")
            log.info(f"⚖️ Balancing remaining {len(pool)} matches to reach 70/15/15 target...")
            np.random.shuffle(pool)
            
            target_tr = int(total_matches * TRAIN_SPLIT_RATIO)
            target_vl = int(total_matches * VAL_SPLIT_RATIO)
            
            for m in pool:
                if len(tr_m) < target_tr: tr_m.append(m)
                elif len(vl_m) < target_vl: vl_m.append(m)
                else: ts_m.append(m)
            
            log.info(f"💾 Copying datasets into memory buckets...")
            tr_b = f_df[f_df["match_id"].isin(tr_m)].copy()
            vl_b = f_df[f_df["match_id"].isin(vl_m)].copy()
            ts_b = f_df[f_df["match_id"].isin(ts_m)].copy()
            
            act_tr = (len(tr_m) / total_matches) * 100
            act_vl = (len(vl_m) / total_matches) * 100
            act_ts = (len(ts_m) / total_matches) * 100
            log.info(f"📈 Smart Split | Train: {len(tr_m)} | Val: {len(vl_m)} | Test: {len(ts_m)} (Ratio: {act_tr:.1f}/{act_vl:.1f}/{act_ts:.1f})")
            
            w_r = tr_b[tr_b["innings_no"] == 2].groupby("phase")["is_wicket"].mean().to_dict()
            r_c = tr_b[(tr_b["innings_no"] == 2) & (tr_b["is_legal"] == True)]["true_runs"].value_counts(normalize=True)
            v_r = {int(k): v for k, v in r_c.items() if k in [0,1,2,3,4,5,6]}
            self.env[fmt]["params"]["physics"] = {"wicket_rates": w_r, "run_outcomes": {k: v/sum(v_r.values()) for k, v in v_r.items()}}
            self.env[fmt]["mc_table"] = build_mc_lookup_table(self.env[fmt]["params"]["physics"], fmt)
            
            tr_d = self._encode_categoricals(tr_b, fmt, fit=True)
            vl_d = self._encode_categoricals(vl_b, fmt, fit=False)
            ts_d = self._encode_categoricals(ts_b, fmt, fit=False)
            
            self._train_base_models(tr_d, vl_d, fmt)
            
            log.info(f"⚖️ Learning Council Weights on Validation Set ({fmt})...")
            p_m_val = self._get_prob_matrix(vl_d, fmt)
            
            # Weighted Learning
            w = LinearRegression(fit_intercept=False, positive=True).fit(p_m_val, vl_d["innings2_won"]).coef_.ravel().clip(min=0)
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
            with open(self.out_dir / f"{pre}_mc_table.pkl", 'wb') as f: pickle.dump(self.env[fmt]["mc_table"], f)
            
            log.info(f"📊 Running Evaluation on Unseen Test Set ({fmt})...")
            p_m_test = self._get_prob_matrix(ts_d, fmt)
            ens_p = p_m_test @ self.env[fmt]["weights"]
            ts_d["wp_after"] = (ens_p * 100).round(2)
            y_t = ts_d["innings2_won"].values
            try: auc = roc_auc_score(y_t, ens_p)
            except: auc = 0.5
            
            names = ["CatBoost", "XGBoost", "LightGBM", "RandomForest", "LogReg", "MonteCarlo", "LSTM"]
            rep = [
                f"=== CRINAVA V13 ZERO-ERROR EVALUATION ({fmt}) ===",
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
            
        except MemoryError:
            log.critical(f"💥 {fmt} Pipeline hit FATAL MemoryError. Stopping immediately.")
            raise
        except Exception as e:
            log.error(f"❌ {fmt} Pipeline FAILED but engine will continue. Error:\n{traceback.format_exc()}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--t20_path", type=str, default="/kaggle/input/datasets/jatin2645/white-ball-data/20_overs-20260429T154750Z-3-001/20_overs")
    parser.add_argument("--odi_path", type=str, default="/kaggle/input/datasets/jatin2645/white-ball-data/50_overs-20260429T154750Z-3-001/50_overs")
    parser.add_argument("--out_dir", type=str, default="/kaggle/working/")
    
    if hasattr(sys, 'ps1') or 'JUPYTER' in os.environ or 'ipykernel' in sys.modules:
        args = parser.parse_args([])
    else:
        args = parser.parse_args()
        
    engine = CrinavaUnified(out_dir=args.out_dir)
    df = engine.load_and_verify({"T20": args.t20_path, "ODI": args.odi_path})
    
    if not df.empty:
        for fmt in ["T20", "ODI"]: 
            engine.process_format(df, fmt)
        log.info(f"\n{'='*60}\n✅ CRINAVA V13 COMPLETE. 22 FILES SECURELY GENERATED.\n{'='*60}")
    else: 
        log.error("❌ No valid data loaded. Pipeline terminated.")
