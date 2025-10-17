"""
Example analysis notebook for interest rates data.

This is a Python script version that can be converted to Jupyter notebook.
Run: jupytext --to notebook example_analysis.py
Or use directly in Jupyter as a .py file.
"""

# %%
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path.cwd().parent))

from src.database.connection import get_db_manager

# %%
# Connect to database
db_manager = get_db_manager()

# %%
# Load Treasury rates
query = """
    SELECT date, maturity, rate 
    FROM treasury_rates 
    WHERE source = 'FRED'
    ORDER BY date, maturity
"""

with db_manager.engine.connect() as conn:
    df_treasury = pd.read_sql(query, conn)

print(f"Loaded {len(df_treasury)} Treasury rate records")
print(f"Date range: {df_treasury['date'].min()} to {df_treasury['date'].max()}")

# %%
# Pivot data for analysis
df_pivot = df_treasury.pivot(index='date', columns='maturity', values='rate')
print("\nAvailable maturities:", df_pivot.columns.tolist())

# %%
# Plot yield curves over time
fig, ax = plt.subplots(figsize=(12, 6))

# Plot yield curves for first day of each year
for year in df_pivot.index.year.unique():
    year_data = df_pivot[df_pivot.index.year == year]
    if len(year_data) > 0:
        first_day = year_data.iloc[0]
        ax.plot(first_day.index, first_day.values, marker='o', label=str(year))

ax.set_xlabel('Maturity')
ax.set_ylabel('Yield (%)')
ax.set_title('Yield Curve Evolution (First Day of Each Year)')
ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()

# %%
# Calculate and plot 2s10s spread
if '10Y' in df_pivot.columns and '2Y' in df_pivot.columns:
    spread_2s10s = df_pivot['10Y'] - df_pivot['2Y']
    
    fig, ax = plt.subplots(figsize=(14, 6))
    ax.plot(spread_2s10s.index, spread_2s10s.values, linewidth=1.5)
    ax.axhline(y=0, color='r', linestyle='--', alpha=0.7, label='Zero (Inversion)')
    ax.fill_between(spread_2s10s.index, spread_2s10s.values, 0, 
                     where=(spread_2s10s < 0), alpha=0.3, color='red', 
                     label='Inverted')
    ax.set_xlabel('Date')
    ax.set_ylabel('Spread (basis points)')
    ax.set_title('2s10s Yield Curve Spread')
    ax.legend()
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.show()
    
    # Inversion statistics
    inversions = spread_2s10s[spread_2s10s < 0]
    print(f"\n2s10s Spread Statistics:")
    print(f"  Current: {spread_2s10s.iloc[-1]:.2f} bps")
    print(f"  Mean: {spread_2s10s.mean():.2f} bps")
    print(f"  Std: {spread_2s10s.std():.2f} bps")
    print(f"  Days inverted: {len(inversions)} ({len(inversions)/len(spread_2s10s)*100:.1f}%)")

# %%
# Load and analyze CFTC COT data
query_cot = """
    SELECT report_date, contract_name,
           noncomm_positions_long, noncomm_positions_short,
           pct_noncomm_long, pct_noncomm_short
    FROM cftc_cot
    WHERE contract_name = '10-YEAR T-NOTE'
    ORDER BY report_date
"""

with db_manager.engine.connect() as conn:
    df_cot = pd.read_sql(query_cot, conn)

if len(df_cot) > 0:
    df_cot['net_noncomm'] = df_cot['noncomm_positions_long'] - df_cot['noncomm_positions_short']
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))
    
    # Net positioning
    ax1.plot(df_cot['report_date'], df_cot['net_noncomm'], linewidth=1.5)
    ax1.axhline(y=0, color='r', linestyle='--', alpha=0.5)
    ax1.set_ylabel('Net Contracts')
    ax1.set_title('CFTC Non-Commercial Net Positioning - 10Y Treasury')
    ax1.grid(True, alpha=0.3)
    
    # Percentage of OI
    ax2.plot(df_cot['report_date'], df_cot['pct_noncomm_long'], 
             label='% Long', linewidth=1.5)
    ax2.plot(df_cot['report_date'], df_cot['pct_noncomm_short'], 
             label='% Short', linewidth=1.5)
    ax2.set_xlabel('Date')
    ax2.set_ylabel('Percentage (%)')
    ax2.set_title('Non-Commercial Positioning as % of Open Interest')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
else:
    print("\nNo CFTC COT data available yet. Run the CFTC collector first.")

# %%
# Correlation analysis
if len(df_pivot.columns) >= 3:
    # Select major maturities
    major_maturities = ['2Y', '5Y', '10Y', '30Y']
    available_maturities = [m for m in major_maturities if m in df_pivot.columns]
    
    if len(available_maturities) >= 2:
        corr_matrix = df_pivot[available_maturities].corr()
        
        fig, ax = plt.subplots(figsize=(10, 8))
        sns.heatmap(corr_matrix, annot=True, fmt='.3f', cmap='coolwarm', 
                   center=0, square=True, ax=ax)
        ax.set_title('Correlation Matrix - Treasury Rates')
        plt.tight_layout()
        plt.show()

# %%
# Rate changes analysis
if '10Y' in df_pivot.columns:
    rate_10y = df_pivot['10Y'].dropna()
    daily_changes = rate_10y.diff()
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Distribution of daily changes
    ax1.hist(daily_changes.dropna(), bins=50, edgecolor='black', alpha=0.7)
    ax1.axvline(x=0, color='r', linestyle='--', alpha=0.7)
    ax1.set_xlabel('Daily Change (bps)')
    ax1.set_ylabel('Frequency')
    ax1.set_title('Distribution of Daily 10Y Rate Changes')
    ax1.grid(True, alpha=0.3)
    
    # Time series of changes
    ax2.plot(daily_changes.index, daily_changes.values, linewidth=0.5, alpha=0.7)
    ax2.axhline(y=0, color='r', linestyle='--', alpha=0.5)
    ax2.set_xlabel('Date')
    ax2.set_ylabel('Daily Change (bps)')
    ax2.set_title('10Y Treasury Rate Daily Changes')
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.show()
    
    print(f"\n10Y Rate Change Statistics:")
    print(f"  Mean: {daily_changes.mean():.3f} bps")
    print(f"  Std: {daily_changes.std():.3f} bps")
    print(f"  Max increase: {daily_changes.max():.2f} bps")
    print(f"  Max decrease: {daily_changes.min():.2f} bps")

# %%
print("\nAnalysis complete!")

