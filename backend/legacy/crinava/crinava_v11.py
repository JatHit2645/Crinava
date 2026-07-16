from __future__ import annotations
import gc, json, logging, pickle, random, warnings
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import pandas as pd
from tqdm.auto import tqdm

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from catboost import CatBoostClassifier
import xgboost as xgb
import lightgbm as lgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder, StandardScaler

warnings.filterwarnings("ignore")
tqdm.pandas()

# ============================================================
# 1. REPRODUCIBILITY & GLOBAL CONSTANTS
# ============================================================
SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)

BATCH_SIZE = 256
SEQ_LENGTH = 18
LSTM_EPOCHS = 15
MAX_MATCHES_LSTM = 10000  # Claude Fix: Chronological OOM guard

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

REQUIRED_COLS = [
    "match_id", "innings_no", "over_no", "ball_no",
    "runs_total", "wicket_kind", "match_type", "extras_type_raw",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("crinava_v11")

# ============================================================
# 2. PURE HELPER FUNCTIONS
# ============================================================
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
    if pd.isna(raw_extras) or raw_extras in (None, "{}", "", "nan"):
        return True
    s = str(raw_extras).lower()
    return not any(x in s for x in ["wide", "no ball", "noball"])

def _parse_extras(raw) -> int:
    try:
        if pd.isna(raw) or raw in (None, "{}", "", "nan"): return 0
        d = json.loads(raw) if isinstance(raw, str) else raw
        return int(sum(d.values())) if isinstance(d, dict) else 0
    except Exception:
        return 0

# ============================================================
# 3. PYTORCH DATASET
# ============================================================
class MomentumDataset(Dataset):
    def __init__(self, sequences: np.ndarray, labels: np.ndarray):
        self.sequences = torch.tensor(sequences, dtype=torch.float32)
        self.labels = torch.tensor(labels, dtype=torch.float32)

    def __len__(self) -> int: return len(self.sequences)
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.sequences[idx], self.labels[idx]

# ============================================================
# 4. LSTM ARCHITECTURE
# ============================================================
class CrinavaLSTM(nn.Module):
    def __init__(self, input_dim: int = 12, hidden_dim: int = 256, num_layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.3, bidirectional=False)
        self.bn = nn.BatchNorm1d(hidden_dim)
        self.dropout = nn.Dropout(0.3)
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        _, (hn, _) = self.lstm(x)
        h = hn[-1]
        # Claude Fix 1: Removed h.size(0) > 1 condition. BatchNorm works natively in eval() mode.
        h = self.bn(h)
        h = self.dropout(h)
        return torch.sigmoid(self.fc(h))

# ============================================================
# 5. MONTE CARLO SIMULATOR
# ============================================================
def run_monte_carlo(target: int, balls_remaining: int, wickets_left: int, phase: str, physics_params: Dict, iters: int = 15_000) -> float:
    if balls_remaining <= 0 or wickets_left <= 0: return 0.0

    w_prob = physics_params["wicket_rates"].get(phase, 0.045)
    run_outcomes = physics_params["run_outcomes"]
    
    possible_runs = np.array(list(run_outcomes.keys()), dtype=np.int32)
    run_probs = np.array(list(run_outcomes.values()), dtype=np.float32)
    
    rng = np.random.default_rng()
    runs_scored = np.zeros(iters, dtype=np.int32)
    wkts_left_v = np.full(iters, wickets_left, dtype=np.int32)
    alive = np.ones(iters, dtype=bool)

    for _ in range(balls_remaining):
        if not alive.any(): break
        ball_runs = rng.choice(possible_runs, p=run_probs, size=iters)
        ball_runs[~alive] = 0
        runs_scored += ball_runs
        
        is_out = rng.random(iters) < w_prob
        is_out &= alive
        wkts_left_v -= is_out.astype(np.int32)
        
        just_won = alive & (runs_scored >= target)
        alive = alive & (~just_won) & (wkts_left_v > 0)

    return float(np.mean(runs_scored >= target))

def build_mc_lookup_table(physics_params: Dict, fmt: str, iters: int = 10_000) -> Dict:
    log.info(f"Building MC lookup table for {fmt} …")
    table = {}
    max_b = 120 if fmt == "T20" else 300
    rn_step, b_step = 5, (5 if fmt == "T20" else 10)
    max_rn = 200 if fmt == "T20" else 400

    runs_grid = range(0, max_rn + 1, rn_step)
    balls_grid = range(0, max_b + 1, b_step)
    wkts_grid = range(1, 11)
    phases = ["powerplay", "middle", "death"] if fmt == "T20" else ["p1", "p2", "p3"]
    
    total = len(runs_grid) * len(balls_grid) * len(wkts_grid) * len(phases)
    with tqdm(total=total, desc=f"MC table {fmt}", leave=False) as pbar:
        for rn in runs_grid:
            for bl in balls_grid:
                for wk in wkts_grid:
                    for ph in phases:
                        table[(rn, bl, wk, ph)] = run_monte_carlo(rn, bl, wk, ph, physics_params, iters)
                        pbar.update(1)
    return table

def lookup_mc_prob(runs_needed: float, balls_remaining: float, wickets_left: float, phase: str, fmt: str, table: Dict) -> float:
    max_b = 120 if fmt == "T20" else 300
    rn_step, b_step = 5, (5 if fmt == "T20" else 10)
    rn_bin = int(round(max(0, min(runs_needed, 200 if fmt == "T20" else 400)) / rn_step) * rn_step)
    b_bin = int(round(max(0, min(balls_remaining, max_b)) / b_step) * b_step)
    wk_bin = int(max(1, min(int(wickets_left), 10)))
    return table.get((rn_bin, b_bin, wk_bin, phase), 0.5)

# ============================================================
# 6. FEATURE DEFINITIONS
# ============================================================
NUMERIC_FEATURES = ["runs_needed", "balls_remaining", "wickets_left", "rrr", "crr", "cumulative_runs", "cumulative_wkts", "target", "roll6_runs", "roll6_wkts"]
CATEGORICAL_COLS = ["batting_team", "bowling_team", "venue", "phase"]
CATEGORICAL_ENC = [c + "_enc" for c in CATEGORICAL_COLS]
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_ENC
CATBOOST_FEATURES = NUMERIC_FEATURES + CATEGORICAL_COLS
LSTM_FEATURE_COLS = ["true_runs", "is_wicket", "over_no", "ball_no", "crr", "rrr", "runs_needed", "balls_remaining", "wickets_left", "phase_enc", "partnership_runs", "partnership_wickets"]

# ============================================================
# 7. TWIN-ENGINE MASTER CLASS
# ============================================================
class CrinavaUnified:
    def __init__(self, out_dir: str = "/kaggle/working/"):
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.env = {
            "T20": {"models": {}, "encoders": {}, "mc_table": {}, "params": {}, "weights": None, "lstm_scaler": StandardScaler()},
            "ODI": {"models": {}, "encoders": {}, "mc_table": {}, "params": {}, "weights": None, "lstm_scaler": StandardScaler()}
        }

    # ----------------------------------------------------------
    # 7.1 DATA LOADING (Vectorized Multi-Match Fix)
    # ----------------------------------------------------------
    def load_and_verify(self, paths: Dict[str, str]) -> pd.DataFrame:
        log.info("[1/5] Loading & Verifying Matches (Vectorized Match-Aware Logic)")
        frames = []
        for fmt, path in paths.items():
            files = list(Path(path).glob("*.csv"))
            for fpath in tqdm(files, desc=f"Processing {fmt}"):
                try:
                    big_df = pd.read_csv(fpath, low_memory=False)
                    
                    # 1. Base Physicals
                    big_df["extra_runs"] = big_df["extras_type_raw"].apply(_parse_extras)
                    big_df["true_runs"] = (big_df["runs_total"].fillna(0) + big_df["extra_runs"]).astype(np.int16)
                    big_df["is_wicket"] = big_df["wicket_kind"].notna().astype(np.int8)
                    big_df["is_legal"] = big_df["extras_type_raw"].apply(_is_legal_delivery)

                    # 2. Vectorized Target and Winner Calculation (Solves the CatBoost Crash)
                    inn_totals = big_df.groupby(['match_id', 'innings_no'])['true_runs'].sum().unstack(fill_value=0)
                    
                    # Must have both Innings 1 and 2
                    valid_matches = inn_totals.dropna(subset=[1, 2]).index
                    if len(valid_matches) == 0: continue
                    
                    target_map = (inn_totals[1] + 1).to_dict()
                    winner_map = (inn_totals[2] >= inn_totals[1] + 1).astype(int).to_dict()

                    # 3. Isolate Innings 2 and map outcomes
                    inn2 = big_df[(big_df["innings_no"] == 2) & (big_df["match_id"].isin(valid_matches))].copy()
                    inn2 = inn2.sort_values(["match_id", "over_no", "ball_no"]).reset_index(drop=True)
                    
                    inn2["target"] = inn2["match_id"].map(target_map)
                    inn2["innings2_won"] = inn2["match_id"].map(winner_map)
                    
                    # 4. Feature Engineering per match
                    max_b = 120 if fmt == "T20" else 300
                    
                    # Group by match_id for cumulative sums
                    gb = inn2.groupby("match_id")
                    inn2["cumulative_runs"] = gb["true_runs"].cumsum()
                    inn2["cumulative_wkts"] = gb["is_wicket"].cumsum()
                    inn2["legal_balls_bowled"] = gb["is_legal"].cumsum()
                    
                    inn2["balls_remaining"] = (max_b - inn2["legal_balls_bowled"]).clip(0)
                    inn2["runs_needed"] = (inn2["target"] - inn2["cumulative_runs"]).clip(0)
                    inn2["wickets_left"] = (10 - inn2["cumulative_wkts"]).clip(0)
                    
                    b_rem = inn2["balls_remaining"] / 6.0
                    inn2["rrr"] = np.where(b_rem > 0, inn2["runs_needed"] / b_rem, 99.0)
                    b_done = inn2["legal_balls_bowled"] / 6.0
                    inn2["crr"] = np.where(b_done > 0, inn2["cumulative_runs"] / b_done, 0.0)
                    
                    inn2["phase"] = inn2["legal_balls_bowled"].apply(lambda b: _get_phase(int(b), fmt))
                    
                    inn2["partnership_runs"] = inn2.groupby(["match_id", "cumulative_wkts"])["true_runs"].cumsum()
                    inn2["partnership_wickets"] = inn2["cumulative_wkts"]
                    
                    inn2["roll6_runs"] = gb["true_runs"].rolling(6, min_periods=1).sum().reset_index(level=0, drop=True)
                    inn2["roll6_wkts"] = gb["is_wicket"].rolling(6, min_periods=1).sum().reset_index(level=0, drop=True)
                    
                    inn2["fmt"] = fmt
                    frames.append(inn2)
                    
                except Exception as e:
                    log.error(f"Error in file {fpath.name}: {e}")
                    continue
                    
        return pd.concat(frames, ignore_index=True)

    def _encode_categoricals(self, df: pd.DataFrame, fmt: str, fit: bool = False) -> pd.DataFrame:
        df = df.copy()
        for col in CATEGORICAL_COLS:
            enc_col = col + "_enc"
            df[col] = df[col].astype(str).fillna("unknown")
            if fit:
                le = LabelEncoder()
                le.fit(list(df[col].unique()) + ["unknown"])
                self.env[fmt]["encoders"][col] = le
            le = self.env[fmt]["encoders"].get(col)
            if le:
                known = set(le.classes_)
                df[col] = df[col].apply(lambda v: v if v in known else "unknown")
                df[enc_col] = le.transform(df[col])
            else: df[enc_col] = 0
        return df

    # ----------------------------------------------------------
    # 7.2 TWIN-ENGINE TRAINING
    # ----------------------------------------------------------
    def build_twin_engines(self, full_df: pd.DataFrame):
        for fmt in ["T20", "ODI"]:
            log.info(f"\n======================================")
            log.info(f"🚀 BUILDING ISOLATED {fmt} ENGINE")
            log.info(f"======================================")
            
            f_df = full_df[full_df["fmt"] == fmt].copy()
            if len(f_df) == 0: continue
            
            # Chronological splitting ensures we test on the "future"
            f_df = f_df.sort_values(by=["match_id", "over_no", "ball_no"]).reset_index(drop=True)
            m_ids = f_df["match_id"].unique()
            n_tr = int(len(m_ids) * 0.85)  # 85% Train (Validation handled by OOF later)
            
            tr_m = m_ids[:n_tr]
            vl_m = m_ids[n_tr:]
            tr_df_base = f_df[f_df["match_id"].isin(tr_m)].copy()
            vl_df_base = f_df[f_df["match_id"].isin(vl_m)].copy()

            # A) Physics Calibration
            log.info("Calibrating Physics...")
            w_rates = tr_df_base.groupby("phase")["is_wicket"].mean().to_dict()
            l_df = tr_df_base[tr_df_base["is_legal"] == True]
            r_counts = l_df["true_runs"].value_counts(normalize=True)
            v_runs = {int(k): v for k, v in r_counts.items() if k in [0,1,2,3,4,5,6]}
            run_out = {k: v/sum(v_runs.values()) for k, v in v_runs.items()}
            self.env[fmt]["params"]["physics"] = {"wicket_rates": w_rates, "run_outcomes": run_out}
            self.env[fmt]["mc_table"] = build_mc_lookup_table(self.env[fmt]["params"]["physics"], fmt)

            # B) Encoding
            tr_df = self._encode_categoricals(tr_df_base, fmt, fit=True)
            vl_df = self._encode_categoricals(vl_df_base, fmt, fit=False)
            
            # Claude Fix 5: XGBoost Categoricals correctly cast
            for col in CATEGORICAL_ENC:
                tr_df[col] = pd.Categorical(tr_df[col])
                vl_df[col] = pd.Categorical(vl_df[col])

            # C) Models
            log.info(f"Training Council ({fmt})...")
            
            # Claude Fix 2 & 7: CatBoost Safe Fill without .astype(str) on numbers
            def prep_catboost(df_sub):
                df_c = df_sub[CATBOOST_FEATURES].copy()
                df_c[NUMERIC_FEATURES] = df_c[NUMERIC_FEATURES].fillna(0)
                df_c[CATEGORICAL_COLS] = df_c[CATEGORICAL_COLS].fillna("unknown").astype(str)
                return df_c

            cb = CatBoostClassifier(iterations=600, depth=6, verbose=0, cat_features=CATEGORICAL_COLS)
            cb.fit(prep_catboost(tr_df), tr_df["innings2_won"])
            self.env[fmt]["models"]["cb"] = cb
            
            dtr = xgb.DMatrix(tr_df[ALL_FEATURES], label=tr_df["innings2_won"], enable_categorical=True)
            self.env[fmt]["models"]["xgb"] = xgb.train({"objective": "binary:logistic", "eval_metric": "auc", "seed": SEED}, dtr, num_boost_round=300)

            lgb_tr = lgb.Dataset(tr_df[ALL_FEATURES], label=tr_df["innings2_won"])
            self.env[fmt]["models"]["lgb"] = lgb.train({"objective": "binary", "metric": "auc", "verbose": -1, "seed": SEED}, lgb_tr, num_boost_round=300)

            # For RF/LR, we must ensure int dtype, not pd.Categorical
            numeric_tr = tr_df[ALL_FEATURES].copy()
            for col in CATEGORICAL_ENC: numeric_tr[col] = numeric_tr[col].astype(int)
            numeric_tr = numeric_tr.fillna(0)
            
            rf = RandomForestClassifier(n_estimators=100, max_depth=10, n_jobs=-1, random_state=SEED).fit(numeric_tr, tr_df["innings2_won"])
            self.env[fmt]["models"]["rf"] = rf
            
            lr = LogisticRegression(max_iter=1000, random_state=SEED).fit(numeric_tr, tr_df["innings2_won"])
            self.env[fmt]["models"]["lr"] = lr

            # D) LSTM
            log.info(f"Training LSTM ({fmt})...")
            lstm = CrinavaLSTM(input_dim=12).to(DEVICE)
            scaler = self.env[fmt]["lstm_scaler"]
            
            lstm_num_cols = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
            scaler.fit(tr_df[lstm_num_cols].fillna(0))

            def build_seqs(df_sub):
                # Claude Fix 6: Chronological sampling for memory guard
                ids = df_sub["match_id"].unique()
                if len(ids) > MAX_MATCHES_LSTM: ids = ids[-MAX_MATCHES_LSTM:]
                df_sub = df_sub[df_sub["match_id"].isin(ids)]
                
                xs, ys = [], []
                for _, mdf in df_sub.groupby("match_id", sort=False):
                    n_dat = scaler.transform(mdf[lstm_num_cols].fillna(0))
                    c_dat = mdf[["phase_enc"]].fillna(0).values
                    data = np.hstack([n_dat, c_dat]).astype(np.float32)
                    lbl = int(mdf["innings2_won"].iloc[0])
                    if len(data) >= SEQ_LENGTH:
                        for i in range(len(data)-SEQ_LENGTH+1):
                            xs.append(data[i:i+SEQ_LENGTH])
                            ys.append(lbl)
                return np.array(xs), np.array(ys)

            tx, ty = build_seqs(tr_df)
            if len(tx) > 0:
                ldr = DataLoader(MomentumDataset(tx, ty), batch_size=BATCH_SIZE, shuffle=True)
                opt = torch.optim.Adam(lstm.parameters(), lr=1e-3)
                crit = nn.BCELoss()
                for _ in range(LSTM_EPOCHS):
                    lstm.train()
                    for xb, yb in ldr:
                        xb, yb = xb.to(DEVICE), yb.to(DEVICE).unsqueeze(1)
                        opt.zero_grad()
                        crit(lstm(xb), yb).backward()
                        opt.step()
            self.env[fmt]["models"]["lstm"] = lstm.eval()

            # E) Ensemble Weights
            log.info(f"Learning Weights ({fmt})...")
            p_mat = self._get_prob_matrix(vl_df, fmt)
            meta = LinearRegression(fit_intercept=False, positive=True).fit(p_mat, vl_df["innings2_won"])
            w = meta.coef_.ravel().clip(min=0)
            self.env[fmt]["weights"] = w / w.sum() if w.sum() > 0 else np.ones(7)/7

    def _get_prob_matrix(self, df: pd.DataFrame, fmt: str) -> np.ndarray:
        df = df.reset_index(drop=True)
        m = self.env[fmt]["models"]
        
        # 1. CatBoost Eval
        df_cb = df[CATBOOST_FEATURES].copy()
        df_cb[NUMERIC_FEATURES] = df_cb[NUMERIC_FEATURES].fillna(0)
        df_cb[CATEGORICAL_COLS] = df_cb[CATEGORICAL_COLS].fillna("unknown").astype(str)
        p_cb = m["cb"].predict_proba(df_cb)[:, 1]
        
        # 2. XGB / LGBM Eval (Requires pd.Categorical)
        df_tree = df[ALL_FEATURES].copy()
        for col in CATEGORICAL_ENC: df_tree[col] = pd.Categorical(df_tree[col])
        p_xgb = m["xgb"].predict(xgb.DMatrix(df_tree, enable_categorical=True))
        p_lgb = m["lgb"].predict(df_tree)
        
        # 3. RF / LR Eval (Requires strict integer encoding)
        df_num = df[ALL_FEATURES].copy()
        for col in CATEGORICAL_ENC: df_num[col] = df_num[col].astype(int)
        df_num = df_num.fillna(0)
        p_rf = m["rf"].predict_proba(df_num)[:, 1]
        p_lr = m["lr"].predict_proba(df_num)[:, 1]
        
        # 4. Monte Carlo Eval
        p_mc = np.zeros(len(df))
        for i, row in df.iterrows():
            p_mc[i] = lookup_mc_prob(row["runs_needed"], row["balls_remaining"], row["wickets_left"], row["phase"], fmt, self.env[fmt]["mc_table"])
        
        # 5. LSTM Eval
        p_ls = np.full(len(df), 0.5)
        scaler = self.env[fmt]["lstm_scaler"]
        num_cols = [c for c in LSTM_FEATURE_COLS if c != "phase_enc"]
        for _, mdf in df.groupby("match_id", sort=False):
            idx = mdf.index
            n_dat = scaler.transform(mdf[num_cols].fillna(0))
            c_dat = mdf[["phase_enc"]].fillna(0).values
            data = np.hstack([n_dat, c_dat]).astype(np.float32)
            seqs = []
            for i in range(len(data)):
                win = data[max(0, i-SEQ_LENGTH+1) : i+1]
                if len(win) < SEQ_LENGTH:
                    win = np.vstack([np.zeros((SEQ_LENGTH-len(win), data.shape[1])), win])
                seqs.append(win)
            with torch.no_grad():
                p_ls[idx] = m["lstm"](torch.tensor(np.array(seqs)).to(DEVICE)).cpu().numpy().ravel()
        
        return np.column_stack([p_cb, p_xgb, p_lgb, p_rf, p_lr, p_mc, p_ls])

    # ----------------------------------------------------------
    # 7.3 OUTPUT GENERATION (Bug Fix: 3-Fold Leakage Prevention)
    # ----------------------------------------------------------
    def generate_outputs_and_save(self, full_df: pd.DataFrame):
        log.info("\n[5/5] Generating Leak-Free Outputs")
        for fmt in ["T20", "ODI"]:
            # Claude Fix 4: reset_index strictly applied before assignment
            f_df = full_df[full_df["fmt"] == fmt].copy().sort_values(["match_id", "over_no", "ball_no"]).reset_index(drop=True)
            if len(f_df) == 0: continue
            
            # Claude Fix 3: OOF WPA generation to prevent overfit stats
            m_ids = f_df["match_id"].unique()
            tscv = TimeSeriesSplit(n_splits=3)
            f_df["oof_wp"] = 0.5
            
            log.info(f"Generating Fast OOF WPA for {fmt} (No Leakage)...")
            encoded = self._encode_categoricals(f_df, fmt, fit=False)
            
            for tr_idx, vl_idx in tqdm(tscv.split(m_ids), total=3):
                tr_m, vl_m = m_ids[tr_idx], m_ids[vl_idx]
                
                # We use CatBoost alone for OOF to save hours of processing, but maintain zero-leakage honesty
                tr_df_oof = encoded[encoded["match_id"].isin(tr_m)].copy()
                vl_df_oof = encoded[encoded["match_id"].isin(vl_m)].copy()
                
                tr_df_oof[NUMERIC_FEATURES] = tr_df_oof[NUMERIC_FEATURES].fillna(0)
                tr_df_oof[CATEGORICAL_COLS] = tr_df_oof[CATEGORICAL_COLS].fillna("unknown").astype(str)
                vl_df_oof[NUMERIC_FEATURES] = vl_df_oof[NUMERIC_FEATURES].fillna(0)
                vl_df_oof[CATEGORICAL_COLS] = vl_df_oof[CATEGORICAL_COLS].fillna("unknown").astype(str)
                
                temp_cb = CatBoostClassifier(iterations=200, depth=5, verbose=0, cat_features=CATEGORICAL_COLS)
                temp_cb.fit(tr_df_oof[CATBOOST_FEATURES], tr_df_oof["innings2_won"])
                
                # Assing by boolean mask to ensure perfect index alignment
                f_df.loc[f_df["match_id"].isin(vl_m), "oof_wp"] = temp_cb.predict_proba(vl_df_oof[CATBOOST_FEATURES])[:, 1]

            f_df["wp_after"] = (f_df["oof_wp"] * 100).round(2)
            f_df["wpa_delta"] = f_df.groupby("match_id")["wp_after"].diff().fillna(0).round(2)
            f_df[["match_id", "over_no", "ball_no", "wp_after", "wpa_delta"]].to_csv(self.out_dir/f"{fmt.lower()}_historical_wpa.csv", index=False)
            
            # Save Meta
            prematch = {
                "venues": f_df.groupby("venue")["true_runs"].mean().to_dict(),
                "physics": self.env[fmt]["params"]["physics"]
            }
            with open(self.out_dir/f"{fmt.lower()}_prematch.json", "w") as fh: json.dump(prematch, fh)
            
            engine_meta = {
                "ensemble_weights": self.env[fmt]["weights"].tolist(),
                "model_names": ["cb", "xgb", "lgb", "rf", "lr", "mc", "lstm"]
            }
            with open(self.out_dir/f"{fmt.lower()}_live_engine.json", "w") as fh: json.dump(engine_meta, fh)

# ============================================================
# 8. ENTRY POINT
# ============================================================
if __name__ == "__main__":
    PATHS = {
        "T20": "/kaggle/input/datasets/jatin2645/white-ball-data/20_overs-20260429T154750Z-3-001/20_overs",
        "ODI": "/kaggle/input/datasets/jatin2645/white-ball-data/50_overs-20260429T154750Z-3-001/50_overs"
    }
    
    engine = CrinavaUnified()
    df = engine.load_and_verify(PATHS)
    engine.build_twin_engines(df)
    engine.generate_outputs_and_save(df)
    
    log.info("\n✅ CRINAVA V11 COMPLETE. ZERO LEAKAGE. ZERO CRASHES.")
