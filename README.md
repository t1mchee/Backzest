# Interest Rates Data Infrastructure

A comprehensive data pipeline for collecting, storing, and visualizing US interest rates, Treasury yields, futures data, and CFTC positioning data from free public sources.

## Features

- **Data Collection**: Automated collectors for FRED, US Treasury, and CFTC data sources
- **Database**: PostgreSQL database with optimized schema for time-series data
- **Visualization**: Interactive Streamlit dashboard with yield curves, rate histories, spreads, and COT analysis
- **Extensible**: Designed for future NLP, PCA, and backtesting layers

## Data Sources

### Primary Sources (Implemented)

1. **FRED (Federal Reserve Economic Data)**
   - Treasury rates (1M, 3M, 6M, 1Y, 2Y, 5Y, 7Y, 10Y, 20Y, 30Y)
   - Policy rates (Fed Funds, SOFR, EFFR)
   - Economic indicators (CPI, unemployment, GDP)
   - Historical data: 10+ years

2. **US Treasury Department**
   - Daily Treasury yield curve
   - Cross-validation with FRED data

3. **CFTC (Commodity Futures Trading Commission)**
   - Weekly Commitments of Traders (COT) reports
   - Interest rate futures positioning
   - Commercial vs. non-commercial trader data

### Secondary Sources (Framework Only)

4. **CME Group**
   - Framework provided for futures settlement prices
   - Note: Requires manual CSV import or API subscription due to licensing

## Installation

### Prerequisites

- Python 3.9+
- PostgreSQL 12+
- FRED API key (free from https://fred.stlouisfed.org/docs/api/api_key.html)

### Setup

1. **Clone and install dependencies:**

```bash
cd /Users/Tim/Backzest
pip install -r requirements.txt
```

2. **Configure PostgreSQL:**

```bash
# Create database
createdb interest_rates_db

# Or using psql:
psql -U postgres
CREATE DATABASE interest_rates_db;
\q
```

3. **Update configuration:**

Edit `config.yaml`:
- Add your FRED API key
- Update database credentials if needed

```yaml
database:
  host: localhost
  port: 5432
  name: interest_rates_db
  user: postgres
  password: your_password

apis:
  fred:
    api_key: YOUR_FRED_API_KEY_HERE
```

4. **Initialize database:**

```bash
python scripts/init_database.py
```

## Usage

### Data Collection

#### Collect all data (recommended for first run):

```bash
python scripts/collect_all.py
```

This will backfill 10 years of data from all sources (configurable in `config.yaml`).

#### Collect from individual sources:

```bash
# FRED data
python -m src.collectors.fred_collector

# Treasury data
python -m src.collectors.treasury_collector

# CFTC COT data
python -m src.collectors.cftc_collector
```

#### Daily updates (recommended for cron/scheduler):

```bash
# Add to crontab for daily updates at 6 PM
0 18 * * * cd /Users/Tim/Backzest && python scripts/collect_all.py --incremental
```

### Visualization Dashboard

Launch the Streamlit dashboard:

```bash
streamlit run src/visualization/app.py
```

Then open http://localhost:8501 in your browser.

### Dashboard Features

1. **Yield Curve Viewer**
   - Interactive date selector
   - Compare multiple dates side-by-side
   - Animated yield curve evolution

2. **Rate History**
   - Time series charts for individual maturities
   - Summary statistics

3. **Spreads Analysis**
   - 2s10s spread (recession indicator)
   - 5s30s spread (long-term outlook)
   - Inversion detection

4. **Policy Rates**
   - Fed Funds rate
   - SOFR
   - Other policy rates

5. **Futures & COT**
   - CFTC positioning visualization
   - Net positioning by trader type
   - Open interest trends

6. **Data Quality**
   - Coverage summary
   - Missing data detection
   - Last update timestamps

## Project Structure

```
/Users/Tim/Backzest/
├── src/
│   ├── collectors/          # Data collection modules
│   │   ├── fred_collector.py
│   │   ├── treasury_collector.py
│   │   ├── cftc_collector.py
│   │   └── cme_collector.py
│   ├── database/            # Database models and utilities
│   │   ├── models.py
│   │   ├── connection.py
│   │   └── schema.sql
│   ├── visualization/       # Streamlit dashboard
│   │   └── app.py
│   └── utils/               # Helper functions
│       └── config.py
├── scripts/                 # Utility scripts
│   ├── init_database.py
│   └── collect_all.py
├── notebooks/               # Exploratory analysis
├── data/                    # Raw data cache (optional)
├── logs/                    # Log files
├── config.yaml              # Configuration
├── requirements.txt         # Python dependencies
└── README.md
```

## Database Schema

### Core Tables

- `treasury_rates`: Daily Treasury yield curve (all maturities)
- `fed_rates`: Federal funds rate, SOFR, and other policy rates
- `futures_prices`: Settlement prices for interest rate futures
- `futures_volume`: Volume and open interest data
- `cftc_cot`: Commitments of Traders positioning data
- `economic_indicators`: Related economic indicators
- `data_collection_log`: Data collection audit log

### Views

- `v_latest_treasury_curve`: Latest yield curve
- `v_latest_policy_rates`: Latest policy rates
- `v_yield_spreads`: Pre-calculated spreads (2s10s, 5s30s, etc.)
- `v_data_quality_summary`: Data completeness metrics

## Configuration

Edit `config.yaml` to customize:

- Database connection settings
- API keys
- Data collection parameters (backfill years, retry attempts)
- FRED series to collect
- Logging configuration

## Development

### Adding New Data Sources

1. Create a new collector in `src/collectors/`
2. Follow the pattern from existing collectors
3. Add appropriate database models in `src/database/models.py`
4. Update schema if needed in `src/database/schema.sql`

### Running Tests

```bash
# Test database connection
python scripts/init_database.py --test

# Test individual collectors
python -m src.collectors.fred_collector
```

## Future Enhancements (Roadmap)

Phase 2: Advanced Analytics
- NLP layer: News sentiment analysis correlated with rate movements
- PCA layer: Principal component analysis on yield curve movements
- Volatility analysis: Realized and implied volatility metrics

Phase 3: Backtesting Framework
- Strategy testing infrastructure
- Performance attribution
- Risk metrics

Phase 4: Real-time Data
- WebSocket connections for live updates
- Intraday data collection
- Alert system for significant moves

Phase 5: Additional Markets
- International interest rates
- Corporate bond spreads
- Credit default swaps

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql -U postgres -d interest_rates_db -c "SELECT 1;"
```

### FRED API Issues

- Verify API key in `config.yaml`
- Check rate limits (120 calls/minute for free tier)
- Ensure series IDs are correct

### Missing Data

- Some series may have limited history
- Markets closed on weekends/holidays
- Check `data_collection_log` table for errors

## Contributing

This is a personal project, but suggestions and improvements are welcome!

## License

For personal and educational use. Please review data source terms:
- FRED: https://fred.stlouisfed.org/legal/
- US Treasury: Public domain
- CFTC: Public domain
- CME: Check licensing terms for commercial use

## Contact

For questions or issues, please open an issue on the project repository.

## Acknowledgments

Data sources:
- Federal Reserve Bank of St. Louis (FRED)
- US Department of the Treasury
- Commodity Futures Trading Commission (CFTC)

Built with:
- Python 3.9+
- PostgreSQL
- Streamlit
- Plotly
- SQLAlchemy
- Pandas

