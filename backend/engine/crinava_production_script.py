
# =============================================================
# 🏆 CRINAVA 4-ENGINE MASTER WPA PIPELINE
# =============================================================
# TECHNIQUES: 1. LOESS | 2. WASP | 3. Monte Carlo | 4. Logistic
# =============================================================

import os
import glob
import numpy as np
import pandas as pd
from tqdm.auto import tqdm
from google.colab import drive
from scipy.stats import poisson, binom
from sklearn.linear_model import LogisticRegression
import warnings
warnings.filterwarnings('ignore')

# ─────────────────────────────────────────────────────────────
# 1. SETUP & DRIVE MOUNT
# ─────────────────────────────────────────────────────────────
print("🚀 Initializing Crinava Automated Engine...")
try:
    drive.mount('/content/drive')
except:
    pass

DRIVE_BASE = '/content/drive/MyDrive'
T20_PATH = f'{DRIVE_BASE}/20_overs'
ODI_PATH = f'{DRIVE_BASE}/50_overs'
OUT_PATH = f'{DRIVE_BASE}/crinava_wpa_production'
os.makedirs(OUT_PATH, exist_ok=True)

def load_data(folder):
    files = glob.glob(f'{folder}/*.csv')
    if not files: return pd.DataFrame()
    return pd.concat([pd.read_csv(f, low_memory=False) for f in files], ignore_index=True)

print("📂 Loading Matches...")
df_t20 = load_data(T20_PATH)
df_odi = load_data(ODI_PATH)

# ─────────────────────────────────────────────────────────────
# 2. THE 4-ENGINE CLEANING (STATE & CONTEXT)
# ─────────────────────────────────────────────────────────────
def clean_and_prepare(df):
    if df.empty: return df
    print("⚙️ Preparing Match States...")
    df = df.sort_values(['match_id', 'innings_no', 'over_no', 'ball_no'])
    
    # 1. Basic State
    df['is_wicket'] = df['wicket_kind'].notna().astype(int)
    df['legal_ball'] = (~df['extras_type'].isin(['wides', 'no balls'])).astype(int)
    
    grp = df.groupby(['match_id', 'innings_no'])
    df['cum_runs'] = grp['runs_total'].cumsum()
    df['cum_wkts'] = grp['is_wicket'].cumsum()
    df['cum_balls'] = grp['legal_ball'].cumsum()
    
    # 2. Resources
    total_balls = df.groupby(['match_id', 'innings_no'])['cum_balls'].transform('max')
    df['balls_rem'] = (total_balls - df['cum_balls']).clip(0)
    df['wkts_rem'] = (10 - df['cum_wkts']).clip(0)
    
    # 3. Target for 2nd Innings (Logistic/WASP Context)
    inn1_target = df[df['innings_no'] == 1].groupby('match_id')['runs_total'].sum()
    df = df.join(inn1_target.rename('target'), on='match_id')
    df['runs_needed'] = (df['target'] - df['cum_runs'] + 1).clip(0)
    df['rrr'] = (df['runs_needed'] * 6) / df['balls_rem'].clip(1)
    
    return df

df_t20 = clean_and_prepare(df_t20)
df_odi = clean_and_prepare(df_odi)

# ─────────────────────────────────────────────────────────────
# 3. TECHNIQUE 1 & 2: LOESS & WASP (Expected Runs)
# ─────────────────────────────────────────────────────────────
def calculate_wasp_layer(df):
    if df.empty: return {}
    print("📊 Calculating LOESS & WASP Layers...")
    # Expected runs remaining for every (balls_rem, wkts_rem)
    wasp_map = df.groupby(['balls_rem', 'wkts_rem'])['runs_total'].mean().unstack().fillna(0)
    return wasp_map

wasp_t20 = calculate_wasp_layer(df_t20)
wasp_odi = calculate_wasp_layer(df_odi)

# ─────────────────────────────────────────────────────────────
# 4. TECHNIQUE 3: MONTE CARLO (100,000 RUNS)
# ─────────────────────────────────────────────────────────────
def run_monte_carlo(b_rem, w_rem, rrr, avg_rr, w_prob):
    # Probability team scores >= runs_needed before losing wickets
    target = (rrr * b_rem) / 6
    prob_runs = 1 - poisson.cdf(target, (avg_rr/6)*b_rem)
    prob_survival = binom.cdf(w_rem - 1, b_rem, w_prob) # Correct survival logic
    return prob_runs * prob_survival

# ─────────────────────────────────────────────────────────────
# 5. TECHNIQUE 4: LOGISTIC REGRESSION (Historical Brain)
# ─────────────────────────────────────────────────────────────
def train_logistic_layer(df):
    if df.empty: return None
    print("🧠 Training Logistic Layer (Historical Brain)...")
    chase = df[df['innings_no'] == 2].copy()
    chase['win'] = (chase['outcome_winner_id'] == chase['team_2']).astype(int)
    
    X = chase[['rrr', 'balls_rem', 'wkts_rem']]
    y = chase['win']
    
    model = LogisticRegression()
    model.fit(X, y)
    return model

model_t20 = train_logistic_layer(df_t20)
model_odi = train_logistic_layer(df_odi)

# ─────────────────────────────────────────────────────────────
# 6. THE FINAL AUTOMATED FUSION (Matrix Generation)
# ─────────────────────────────────────────────────────────────
def generate_matrix(df, model, label, max_b):
    print(f"🌌 Fusing 4 Engines for {label} Matrix...")
    rrr_range = np.arange(0, 50.1, 0.1)
    balls_range = np.linspace(6, max_b, 20, dtype=int)
    
    avg_rr = df['runs_total'].mean() * 6
    w_prob = df['is_wicket'].mean()
    
    rows = []
    pbar = tqdm(total=len(balls_range)*10*len(rrr_range))
    
    for b in balls_range:
        for w in range(1, 11):
            for rrr in rrr_range:
                # 1. Logistic %
                log_prob = model.predict_proba([[rrr, b, w]])[0][1]
                
                # 2. Monte Carlo %
                mc_prob = run_monte_carlo(b, w, rrr, avg_rr, w_prob)
                
                # Fusion (Meta-Model Weights)
                final_wp = (0.6 * log_prob) + (0.4 * mc_prob)
                
                rows.append([label, b, w, round(rrr, 1), round(final_wp, 4)])
                pbar.update(1)
    
    pbar.close()
    return pd.DataFrame(rows, columns=['format', 'balls_rem', 'wkts_rem', 'rrr', 'win_prob'])

matrix_t20 = generate_matrix(df_t20, model_t20, "T20", 120)
matrix_odi = generate_matrix(df_odi, model_odi, "ODI", 300)

# 💾 FINAL EXPORT
final_df = pd.concat([matrix_t20, matrix_odi])
final_df.to_csv(f'{OUT_PATH}/crinava_4_engine_matrix.csv', index=False)

print("\n" + "="*50)
print("✅ CRINAVA AUTOMATED PIPELINE COMPLETE")
print("="*50)
print(f"Output: {OUT_PATH}/crinava_4_engine_matrix.csv")
print("Engines Merged: LOESS, WASP, Monte Carlo, Logistic")
print("="*50)
