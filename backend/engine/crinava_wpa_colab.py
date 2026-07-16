
# =============================================================
# CRINAVA WPA PIPELINE - GOOGLE COLAB NOTEBOOK
# Run each CELL one at a time in order
# =============================================================

# ─────────────────────────────────────────────────────────────
# CELL 1: Mount Google Drive & Install Libraries
# ─────────────────────────────────────────────────────────────
from google.colab import drive
drive.mount('/content/drive')

import subprocess
subprocess.run(['pip', 'install', 'statsmodels', 'scikit-learn', 'supabase'], capture_output=True)

import os
import glob
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
import warnings
warnings.filterwarnings('ignore')

print("✅ All libraries loaded successfully")

# ─────────────────────────────────────────────────────────────
# CELL 2: Configure Your Folder Paths
# ─────────────────────────────────────────────────────────────
# UPDATE THESE PATHS TO MATCH YOUR GOOGLE DRIVE FOLDER NAMES
DRIVE_BASE = '/content/drive/MyDrive'

T20_FOLDER  = f'{DRIVE_BASE}/20_overs'   # Folder with T20/IT20 year CSVs
ODI_FOLDER  = f'{DRIVE_BASE}/50_overs'   # Folder with ODI/ODM year CSVs

OUTPUT_FOLDER = f'{DRIVE_BASE}/crinava_wpa_output'
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Confirm folders exist
for folder in [T20_FOLDER, ODI_FOLDER]:
    files = glob.glob(f'{folder}/*.csv')
    print(f"📁 {folder}: {len(files)} CSV files found")
    for f in files:
        print(f"   → {os.path.basename(f)}")

# ─────────────────────────────────────────────────────────────
# CELL 3: Load ALL Year CSVs for Each Format
# ─────────────────────────────────────────────────────────────
def load_all_csvs(folder_path, format_label):
    """Load and combine all year CSVs from a folder"""
    all_files = glob.glob(f'{folder_path}/*.csv')
    
    if not all_files:
        print(f"❌ No CSV files found in {folder_path}")
        return pd.DataFrame()
    
    dfs = []
    for file in sorted(all_files):
        try:
            df = pd.read_csv(file, low_memory=False)
            df['source_file'] = os.path.basename(file)
            dfs.append(df)
            print(f"   ✅ Loaded {os.path.basename(file)}: {len(df):,} rows")
        except Exception as e:
            print(f"   ❌ Error loading {file}: {e}")
    
    if not dfs:
        return pd.DataFrame()
    
    combined = pd.concat(dfs, ignore_index=True)
    combined['format_group'] = format_label
    print(f"\n📊 {format_label} Total: {len(combined):,} balls | {combined['match_id'].nunique():,} matches")
    return combined

print("Loading T20 data...")
t20_df = load_all_csvs(T20_FOLDER, 'T20')

print("\nLoading ODI data...")
odi_df = load_all_csvs(ODI_FOLDER, 'ODI')

print("\n" + "="*50)
print(f"TOTAL BALLS LOADED: {len(t20_df) + len(odi_df):,}")
print("="*50)

# ─────────────────────────────────────────────────────────────
# CELL 4: Show Column Names (IMPORTANT - check these)
# ─────────────────────────────────────────────────────────────
print("T20 Columns:", list(t20_df.columns))
print("\nODI Columns:", list(odi_df.columns))
print("\nFirst 3 rows of T20 data:")
print(t20_df.head(3).to_string())

# ─────────────────────────────────────────────────────────────
# CELL 5: Configure Column Name Mapping
# ─────────────────────────────────────────────────────────────
# UPDATE THESE TO MATCH YOUR ACTUAL COLUMN NAMES FROM CELL 4

COL = {
    'match_id':       'match_id',
    'innings_no':     'innings_no',
    'over_no':        'over_no',
    'runs_total':     'runs_total',
    'runs_batter':    'runs_batter',
    'extras_type':    'extras_type',
    'wicket_kind':    'wicket_kind',
    'match_type':     'match_type',
    'venue':          'venue',
    'winner_id':      'outcome_winner_id',
    'team_1':         'team_1',
    'team_2':         'team_2',
}

print("✅ Column mapping configured")
print("If any column names are wrong, update COL{} above and re-run this cell")

# ─────────────────────────────────────────────────────────────
# CELL 6: Clean & Prepare the Data
# ─────────────────────────────────────────────────────────────
def prepare_data(df, format_group, max_overs):
    """Clean data and calculate running match state for each ball"""
    
    # Rename columns to standard names
    df = df.rename(columns={v: k for k, v in COL.items()})
    
    # Keep only needed columns
    needed = ['match_id','innings_no','over_no','runs_total','runs_batter',
              'extras_type','wicket_kind','venue','winner_id','team_1','team_2']
    df = df[[c for c in needed if c in df.columns]].copy()
    
    # Drop rows with missing critical fields
    df = df.dropna(subset=['match_id','innings_no','over_no','winner_id'])
    
    # Normalize over_no to 0-based (if yours starts at 1, subtract 1)
    if df['over_no'].min() >= 1:
        df['over_no'] = df['over_no'] - 1
        print(f"   📌 over_no normalized to 0-based indexing")
    
    # Mark legal balls (not wides for batting)
    df['is_legal_ball'] = ~df['extras_type'].isin(['wides', 'wide'])
    df['is_wicket'] = df['wicket_kind'].notna() & ~df['wicket_kind'].isin([
        'run out', 'retired out', 'retired hurt', 'obstructing the field'
    ])
    
    # Sort properly
    df = df.sort_values(['match_id', 'innings_no', 'over_no']).reset_index(drop=True)
    
    # Calculate cumulative state per innings
    grp = df.groupby(['match_id', 'innings_no'])
    
    df['balls_bowled']        = grp['is_legal_ball'].cumsum()
    df['cumulative_runs']     = grp['runs_total'].cumsum()
    df['cumulative_wickets']  = grp['is_wicket'].cumsum()
    
    # Total legal balls per innings
    total_legal = grp['is_legal_ball'].transform('sum')
    df['balls_remaining']   = total_legal - df['balls_bowled']
    df['wickets_remaining'] = 10 - df['cumulative_wickets']
    
    # Max overs for this format
    df['max_balls'] = max_overs * 6
    df['format_group'] = format_group
    
    print(f"✅ {format_group}: {len(df):,} balls prepared")
    return df

print("Preparing T20 data (120 balls max)...")
t20_clean = prepare_data(t20_df.copy(), 'T20', max_overs=20)

print("\nPreparing ODI data (300 balls max)...")
odi_clean = prepare_data(odi_df.copy(), 'ODI', max_overs=50)

print("\n✅ Data preparation complete!")

# ─────────────────────────────────────────────────────────────
# CELL 7: Build the LOESS "Expected Scoring Curves"
# ─────────────────────────────────────────────────────────────
def build_wasp_table(df, format_group):
    """
    Build the V(b, w) Expected Remaining Runs table.
    For every (balls_remaining, wickets_remaining) state,
    calculate average runs actually scored from that point.
    """
    print(f"\nBuilding WASP table for {format_group}...")
    
    # Only use innings 1 for "expected score" baseline
    inn1 = df[df['innings_no'] == 1].copy()
    
    # Total innings score
    total_scores = inn1.groupby(['match_id'])['runs_total'].sum().reset_index()
    total_scores.columns = ['match_id', 'innings_total']
    inn1 = inn1.merge(total_scores, on='match_id')
    
    # Runs remaining from this point
    inn1['runs_remaining'] = inn1['innings_total'] - inn1['cumulative_runs']
    
    # Bucket balls_remaining and wickets_remaining
    inn1['balls_bucket']  = (inn1['balls_remaining'] // 6) * 6   # Groups of 6
    inn1['wickets_bucket'] = inn1['wickets_remaining'].clip(0, 10)
    
    # Average expected runs for each state
    wasp = inn1.groupby(['balls_bucket', 'wickets_bucket']).agg(
        expected_runs = ('runs_remaining', 'mean'),
        sample_count  = ('runs_remaining', 'count')
    ).reset_index()
    
    # Only keep states with enough data (at least 30 samples)
    wasp = wasp[wasp['sample_count'] >= 30]
    wasp['format_group'] = format_group
    
    print(f"   ✅ {len(wasp):,} unique states in WASP table")
    return wasp

wasp_t20 = build_wasp_table(t20_clean, 'T20')
wasp_odi = build_wasp_table(odi_clean, 'ODI')

wasp_all = pd.concat([wasp_t20, wasp_odi], ignore_index=True)
wasp_all.to_csv(f'{OUTPUT_FOLDER}/wasp_expected_runs.csv', index=False)
print(f"\n💾 WASP table saved: {len(wasp_all):,} rows")
print(wasp_t20.sort_values('balls_bucket', ascending=False).head(10).to_string())

# ─────────────────────────────────────────────────────────────
# CELL 8: Build Win Probability Training Dataset
# ─────────────────────────────────────────────────────────────
def build_win_probability_dataset(df, format_group):
    """
    For every ball in Innings 2 (chasing), label:
    1 = batting team eventually won
    0 = batting team eventually lost
    """
    print(f"\nBuilding Win Probability dataset for {format_group}...")
    
    # Only innings 2 (chasing innings)
    inn2 = df[df['innings_no'] == 2].copy()
    
    # Determine if batting team won
    # In innings 2, if winner_id == team batting, they won
    # We use team_2 as batting team in innings 2 (standard cricket)
    inn2['batting_team_won'] = (inn2['winner_id'] == inn2['team_2']).astype(int)
    
    # Get innings 1 total (the target)
    inn1_totals = df[df['innings_no'] == 1].groupby('match_id')['runs_total'].sum()
    inn1_totals.name = 'innings1_total'
    inn2 = inn2.join(inn1_totals, on='match_id')
    
    # Calculate chase-specific features
    inn2['runs_needed']  = inn2['innings1_total'] - inn2['cumulative_runs'] + 1
    inn2['rrr']          = inn2['runs_needed'] / (inn2['balls_remaining'] / 6).clip(lower=0.1)
    inn2['phase']        = pd.cut(inn2['over_no'],
                                   bins=[-1, 5, 14, 100],
                                   labels=['powerplay', 'middle', 'death'])
    
    # Select features for logistic regression
    features = inn2[[
        'rrr',                   # Required Run Rate
        'wickets_remaining',     # Resources left
        'balls_remaining',       # Balls left
        'batting_team_won'       # Target (did they win?)
    ]].dropna()
    
    # Remove impossible states
    features = features[
        (features['balls_remaining'] > 0) &
        (features['wickets_remaining'] > 0) &
        (features['runs_needed'] > 0)
    ]
    
    features['format_group'] = format_group
    print(f"   ✅ {len(features):,} training samples ready")
    return features

train_t20 = build_win_probability_dataset(t20_clean, 'T20')
train_odi = build_win_probability_dataset(odi_clean, 'ODI')

print(f"\n✅ Training data ready:")
print(f"   T20: {len(train_t20):,} samples")
print(f"   ODI: {len(train_odi):,} samples")

# ─────────────────────────────────────────────────────────────
# CELL 9: Train the Logistic Regression (Find Beta Values)
# ─────────────────────────────────────────────────────────────
def train_win_model(train_df, format_group):
    """Train Logistic Regression to find beta coefficients"""
    print(f"\nTraining model for {format_group}...")
    
    feature_cols = ['rrr', 'wickets_remaining', 'balls_remaining']
    X = train_df[feature_cols].values
    y = train_df['batting_team_won'].values
    
    # Normalize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train Logistic Regression
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_scaled, y)
    
    # Check accuracy
    preds = model.predict(X_scaled)
    acc   = accuracy_score(y, preds)
    
    # Extract beta coefficients
    betas = {
        'intercept':          float(model.intercept_[0]),
        'beta_rrr':           float(model.coef_[0][0]),
        'beta_wickets':       float(model.coef_[0][1]),
        'beta_balls':         float(model.coef_[0][2]),
        'scaler_mean':        scaler.mean_.tolist(),
        'scaler_scale':       scaler.scale_.tolist(),
        'format_group':       format_group,
        'training_samples':   len(train_df),
        'accuracy':           round(acc * 100, 2)
    }
    
    print(f"   ✅ Model accuracy: {acc*100:.1f}%")
    print(f"   Beta (RRR):      {betas['beta_rrr']:.4f}")
    print(f"   Beta (Wickets):  {betas['beta_wickets']:.4f}")
    print(f"   Beta (Balls):    {betas['beta_balls']:.4f}")
    
    return model, scaler, betas

model_t20, scaler_t20, betas_t20 = train_win_model(train_t20, 'T20')
model_odi, scaler_odi, betas_odi = train_win_model(train_odi, 'ODI')

# Save beta coefficients
all_betas = {'T20': betas_t20, 'ODI': betas_odi}
with open(f'{OUTPUT_FOLDER}/beta_coefficients.json', 'w') as f:
    json.dump(all_betas, f, indent=2)

print(f"\n💾 Beta coefficients saved to Google Drive!")
print(json.dumps(all_betas, indent=2))

# ─────────────────────────────────────────────────────────────
# CELL 10: Build Win Probability Matrix (The Lookup Table)
# ─────────────────────────────────────────────────────────────
def build_win_prob_matrix(model, scaler, format_group, max_overs):
    """
    Pre-compute win probability for every possible game state.
    This is stored in Supabase so ball-by-ball WPA is instant.
    """
    print(f"\nBuilding Win Probability Matrix for {format_group}...")
    
    max_balls = max_overs * 6
    rows = []
    
    for balls_rem in range(0, max_balls + 6, 6):       # Every over
        for wickets_rem in range(1, 11):                # 1-10 wickets
            for rrr in np.arange(0, 25.5, 0.5):        # RRR 0 to 25
                
                X = np.array([[rrr, wickets_rem, balls_rem]])
                X_scaled = scaler.transform(X)
                win_prob = model.predict_proba(X_scaled)[0][1]
                
                rows.append({
                    'format_group':    format_group,
                    'balls_remaining': balls_rem,
                    'wickets_remaining': wickets_rem,
                    'rrr_bucket':      round(rrr, 1),
                    'win_probability': round(float(win_prob), 4)
                })
    
    matrix = pd.DataFrame(rows)
    print(f"   ✅ {len(matrix):,} states computed")
    return matrix

matrix_t20 = build_win_prob_matrix(model_t20, scaler_t20, 'T20', max_overs=20)
matrix_odi = build_win_prob_matrix(model_odi, scaler_odi, 'ODI', max_overs=50)

win_prob_matrix = pd.concat([matrix_t20, matrix_odi], ignore_index=True)
win_prob_matrix.to_csv(f'{OUTPUT_FOLDER}/win_probability_matrix.csv', index=False)

print(f"\n💾 Win Probability Matrix saved: {len(win_prob_matrix):,} rows")
print("\nSample rows (T20, 6 balls left, 5 wickets, various RRRs):")
sample = matrix_t20[
    (matrix_t20['balls_remaining'] == 6) &
    (matrix_t20['wickets_remaining'] == 5)
][['rrr_bucket', 'win_probability']].head(10)
print(sample.to_string())

# ─────────────────────────────────────────────────────────────
# CELL 11: FINAL SUMMARY
# ─────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("✅ CRINAVA WPA PIPELINE - STEP 1 COMPLETE!")
print("="*60)
print(f"\nFiles saved to: {OUTPUT_FOLDER}")
print(f"  1. wasp_expected_runs.csv     ← Upload to Supabase table: wasp_expected_runs")
print(f"  2. beta_coefficients.json     ← Hardcode into your SQL function")
print(f"  3. win_probability_matrix.csv ← Upload to Supabase table: win_probability_matrix")
print(f"\nModel Performance:")
print(f"  T20 Accuracy: {betas_t20['accuracy']}%")
print(f"  ODI Accuracy: {betas_odi['accuracy']}%")
print(f"\nNext Step: Upload the 2 CSV files to Supabase")
print("="*60)
