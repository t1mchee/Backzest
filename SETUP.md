# Setup Guide

## Step-by-Step Installation

### 1. Install PostgreSQL

#### macOS (using Homebrew):
```bash
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb interest_rates_db
```

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb interest_rates_db
```

#### Windows:
Download and install from: https://www.postgresql.org/download/windows/

### 2. Install Python Dependencies

```bash
cd /Users/Tim/Backzest
pip install -r requirements.txt
```

Or use a virtual environment (recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Get FRED API Key

1. Go to https://fred.stlouisfed.org/
2. Create a free account
3. Request an API key at https://fred.stlouisfed.org/docs/api/api_key.html
4. Copy your API key

### 4. Configure Application

Edit `config.yaml`:

```yaml
database:
  host: localhost
  port: 5432
  name: interest_rates_db
  user: postgres
  password: your_password  # Update this!

apis:
  fred:
    api_key: YOUR_FRED_API_KEY_HERE  # Paste your key here!
```

### 5. Initialize Database

```bash
python scripts/init_database.py
```

Expected output:
```
✓ treasury_rates
✓ fed_rates
✓ futures_prices
... (more tables)
Database is ready!
```

### 6. Collect Data

For initial setup (collects 10 years of data):

```bash
python scripts/collect_all.py
```

This will take 5-10 minutes depending on your internet connection.

For daily updates (collects last 30 days):

```bash
python scripts/collect_all.py --incremental
```

### 7. Launch Dashboard

```bash
streamlit run src/visualization/app.py
```

Open http://localhost:8501 in your browser.

## Troubleshooting

### Database Connection Error

**Problem**: `could not connect to server`

**Solution**:
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL
# macOS:
brew services start postgresql@14

# Linux:
sudo systemctl start postgresql
```

### FRED API Error

**Problem**: `Invalid API key`

**Solution**:
1. Check that you've added your API key to `config.yaml`
2. Make sure there are no extra spaces or quotes
3. Verify key at https://fred.stlouisfed.org/docs/api/api_key.html

### Import Errors

**Problem**: `ModuleNotFoundError`

**Solution**:
```bash
# Make sure you're in the project root
cd /Users/Tim/Backzest

# Reinstall dependencies
pip install -r requirements.txt
```

### Empty Dashboard

**Problem**: Dashboard shows "No data available"

**Solution**:
```bash
# Run data collection
python scripts/collect_all.py

# Check database has data
python scripts/init_database.py --test
```

## Verification Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `interest_rates_db` created
- [ ] Python dependencies installed
- [ ] FRED API key added to `config.yaml`
- [ ] Database schema initialized (`python scripts/init_database.py`)
- [ ] Data collected (`python scripts/collect_all.py`)
- [ ] Dashboard accessible (`streamlit run src/visualization/app.py`)

## Next Steps

After successful setup:

1. **Schedule Daily Updates**: Add to crontab/Task Scheduler
   ```bash
   # Add to crontab (Linux/macOS)
   0 18 * * * cd /Users/Tim/Backzest && /path/to/python scripts/collect_all.py --incremental
   ```

2. **Explore Data**: Check out `notebooks/example_analysis.py`

3. **Customize**: Edit `config.yaml` to add more FRED series

4. **Backup Database**:
   ```bash
   pg_dump interest_rates_db > backup_$(date +%Y%m%d).sql
   ```

## Performance Tips

1. **PostgreSQL Tuning**: For large datasets, consider:
   - Increase `shared_buffers` in `postgresql.conf`
   - Enable `autovacuum`
   - Create additional indexes for common queries

2. **Data Collection**: 
   - Use `--incremental` for daily updates
   - Run during off-peak hours
   - Monitor `data_collection_log` table for errors

3. **Dashboard**:
   - Cache is enabled (1 hour TTL)
   - Limit date ranges for large datasets
   - Consider deploying on a server for team access

## Support

For issues:
1. Check logs in `logs/` directory
2. Review `data_collection_log` table for collection errors
3. Consult README.md for detailed documentation

