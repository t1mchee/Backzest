# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

- Python 3.9+ installed
- PostgreSQL installed and running
- 10 minutes for initial data collection

## Installation

### 1. Install Dependencies

```bash
cd /Users/Tim/Backzest
pip install -r requirements.txt
```

### 2. Setup PostgreSQL

```bash
# Create database
createdb interest_rates_db

# Or if using sudo:
sudo -u postgres createdb interest_rates_db
```

### 3. Get FRED API Key

1. Visit: https://fred.stlouisfed.org/docs/api/api_key.html
2. Sign up (free)
3. Copy your API key

### 4. Configure

Edit `config.yaml` and update:
- Database password (if needed)
- FRED API key (required!)

```yaml
database:
  password: your_password  # Change if needed

apis:
  fred:
    api_key: YOUR_KEY_HERE  # Paste your FRED API key
```

### 5. Initialize Database

```bash
python scripts/init_database.py
```

You should see:
```
✓ treasury_rates
✓ fed_rates
... (more tables)
Database is ready!
```

### 6. Collect Data

```bash
python scripts/collect_all.py
```

This collects 10 years of data (~5-10 minutes). Get a coffee! ☕

### 7. Launch Dashboard

```bash
streamlit run src/visualization/app.py
```

Open http://localhost:8501 in your browser 🎉

## Validation

Check if everything is working:

```bash
python scripts/validate_setup.py
```

## What You Get

### Data Sources
- **FRED**: Treasury rates, policy rates, economic indicators
- **US Treasury**: Official daily yield curve
- **CFTC**: Commitments of Traders positioning

### Dashboard Pages
1. **Yield Curve**: Interactive yield curve viewer
2. **Rate History**: Historical rates for any maturity
3. **Spreads**: 2s10s and 5s30s spread analysis
4. **Policy Rates**: Fed Funds, SOFR, etc.
5. **Futures & COT**: CFTC positioning data
6. **Data Quality**: Data coverage and status

## Daily Updates

### Manual Update
```bash
python scripts/collect_all.py --incremental
```

### Automated (Cron)
```bash
# Add to crontab (runs daily at 6 PM)
crontab -e

# Add this line:
0 18 * * * cd /Users/Tim/Backzest && python scripts/collect_all.py --incremental
```

## Example Queries

### Using Python
```python
from src.database.connection import get_db_manager
import pandas as pd

db = get_db_manager()

# Get latest 10Y rate
with db.engine.connect() as conn:
    df = pd.read_sql("""
        SELECT date, rate 
        FROM treasury_rates 
        WHERE maturity = '10Y' 
        ORDER BY date DESC 
        LIMIT 1
    """, conn)
    print(df)
```

### Using psql
```bash
psql -U postgres interest_rates_db

# Get latest yield curve
SELECT * FROM v_latest_treasury_curve;

# Check data quality
SELECT * FROM v_data_quality_summary;
```

## Troubleshooting

### Database won't connect
```bash
# Check PostgreSQL status
pg_isready

# Start if needed
brew services start postgresql@14  # macOS
sudo systemctl start postgresql     # Linux
```

### FRED API errors
- Check your API key in `config.yaml`
- No quotes or extra spaces
- Free tier: 120 calls/minute

### No data in dashboard
```bash
# Run data collection
python scripts/collect_all.py

# Verify data was collected
python scripts/validate_setup.py
```

## Next Steps

1. **Explore**: Open `notebooks/example_analysis.py` for analysis examples
2. **Customize**: Edit `config.yaml` to add more FRED series
3. **Extend**: Add your own collectors or analysis modules

## Resources

- **Full Documentation**: See [README.md](README.md)
- **Setup Details**: See [SETUP.md](SETUP.md)
- **FRED API Docs**: https://fred.stlouisfed.org/docs/api/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

## Common Commands

```bash
# Validate setup
python scripts/validate_setup.py

# Initialize database
python scripts/init_database.py

# Collect all data (10 years)
python scripts/collect_all.py

# Daily update
python scripts/collect_all.py --incremental

# Launch dashboard
streamlit run src/visualization/app.py

# Database shell
psql -U postgres interest_rates_db
```

## Questions?

Check the main [README.md](README.md) for detailed documentation.

Happy analyzing! 📈

