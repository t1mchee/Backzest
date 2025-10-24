"""
Collect Historical Treasury Yield Data from TradingView
Downloads past yield curve data for backtesting
"""

import requests
import time
from datetime import datetime, timedelta
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.database.connection import DatabaseManager
from loguru import logger

# TradingView symbols for Treasury yields
YIELD_SYMBOLS = {
    '3M': 'TVC:US03MY',
    '6M': 'TVC:US06MY',
    '1Y': 'TVC:US01Y',
    '2Y': 'TVC:US02Y',
    '5Y': 'TVC:US05Y',
    '10Y': 'TVC:US10Y',
    '30Y': 'TVC:US30Y',
}

TRADINGVIEW_SERVICE = 'http://localhost:3002'


def collect_historical_data(symbol: str, limit: int = 1000):
    """
    Request historical data from TradingView service
    """
    try:
        logger.info(f"Requesting {limit} historical bars for {symbol}")
        
        response = requests.get(
            f"{TRADINGVIEW_SERVICE}/historical/{symbol}",
            params={'timeframe': 'D', 'limit': limit},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            logger.success(f"Got {data['count']} bars for {symbol}")
            return data['data']
        else:
            logger.error(f"Failed to get data for {symbol}: {response.status_code}")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching {symbol}: {e}")
        return []


def check_database_coverage():
    """Check how much historical data we have"""
    import pandas as pd
    db_manager = DatabaseManager()
    
    query = """
        SELECT 
            symbol,
            COUNT(*) as record_count,
            MIN(timestamp)::date as earliest,
            MAX(timestamp)::date as latest,
            MAX(timestamp)::date - MIN(timestamp)::date as days_coverage
        FROM tradingview_prices
        WHERE symbol LIKE 'TVC:US%'
          AND timeframe = 'D'
        GROUP BY symbol
        ORDER BY symbol
    """
    
    try:
        df = pd.read_sql(query, db_manager.engine)
        
        if not df.empty:
            logger.info("📊 Current Historical Coverage:")
            for _, row in df.iterrows():
                logger.info(f"  {row['symbol']:15} {row['record_count']:4} records | {row['earliest']} to {row['latest']} ({row['days_coverage']} days)")
        else:
            logger.warning("No historical data found in database")
            
        return df
            
    except Exception as e:
        logger.error(f"Error checking database: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main collection routine"""
    logger.info("🚀 Starting Historical Yield Data Collection")
    logger.info("")
    
    # Check current coverage
    logger.info("📋 Checking existing data...")
    check_database_coverage()
    logger.info("")
    
    # The TradingView service will automatically collect and store data
    # We just need to wait for it to accumulate
    logger.info("💡 Historical Data Collection Strategy:")
    logger.info("")
    logger.info("TradingView service collects data automatically when symbols are subscribed.")
    logger.info("The service is currently subscribed to all Treasury yields (daily timeframe).")
    logger.info("")
    logger.info("Data will accumulate over time as TradingView provides it.")
    logger.info("For immediate backtesting, you can:")
    logger.info("")
    logger.info("1. Use the live data that's being collected daily")
    logger.info("2. Wait 30-90 days for substantial historical data")
    logger.info("3. Import historical data from another source (FRED API)")
    logger.info("")
    
    # Alternative: Import from FRED
    logger.info("🔄 Alternative: Importing historical yields from FRED...")
    import_from_fred()
    
    logger.info("")
    logger.info("✅ Historical data collection configured!")
    logger.info("📊 Check coverage with: python scripts/collect_historical_yields.py")


def import_from_fred():
    """Import historical Treasury yields from FRED as a backup"""
    try:
        from fredapi import Fred
        import pandas as pd
        from src.utils.config import Config
        
        config = Config()
        fred_api_key = config.get('apis', {}).get('fred', {}).get('api_key')
        
        if not fred_api_key:
            logger.warning("No FRED API key found. Skipping FRED import.")
            return
        
        fred = Fred(api_key=fred_api_key)
        db_manager = DatabaseManager()
        
        # FRED series for Treasury yields
        fred_series = {
            'DGS3MO': 'TVC:US03MY',
            'DGS6MO': 'TVC:US06MY',
            'DGS1': 'TVC:US01Y',
            'DGS2': 'TVC:US02Y',
            'DGS5': 'TVC:US05Y',
            'DGS10': 'TVC:US10Y',
            'DGS30': 'TVC:US30Y',
        }
        
        logger.info(f"📥 Importing historical yields from FRED (last 5 years)...")
        start_date = (datetime.now() - timedelta(days=365*5)).strftime('%Y-%m-%d')
        
        total_imported = 0
        
        for fred_symbol, tv_symbol in fred_series.items():
            try:
                logger.info(f"  Fetching {fred_symbol} -> {tv_symbol}")
                
                # Get data from FRED
                series = fred.get_series(fred_symbol, start_date=start_date)
                
                if series.empty:
                    logger.warning(f"    No data for {fred_symbol}")
                    continue
                
                # Convert to dataframe
                df = pd.DataFrame(series, columns=['rate'])
                df = df.dropna()
                df['symbol'] = tv_symbol
                df['timeframe'] = 'D'
                df['timestamp'] = df.index
                df['price'] = df['rate']
                df['source'] = 'FRED_IMPORT'
                
                # Insert into database
                insert_query = """
                    INSERT INTO tradingview_prices 
                    (timestamp, symbol, price, open, high, low, volume, timeframe, source)
                    VALUES (%(timestamp)s, %(symbol)s, %(price)s, %(open)s, %(high)s, %(low)s, %(volume)s, %(timeframe)s, %(source)s)
                    ON CONFLICT (timestamp, symbol, timeframe) DO NOTHING
                """
                
                conn = db_manager.engine.raw_connection()
                cursor = conn.cursor()
                records = 0
                
                try:
                    for _, row in df.iterrows():
                        cursor.execute(insert_query, {
                            'timestamp': row['timestamp'],
                            'symbol': row['symbol'],
                            'price': float(row['rate']),
                            'open': float(row['rate']),
                            'high': None,
                            'low': None,
                            'volume': None,
                            'timeframe': 'D',
                            'source': 'FRED_IMPORT'
                        })
                        records += 1
                    
                    conn.commit()
                finally:
                    cursor.close()
                    conn.close()
                
                logger.success(f"    ✅ Imported {records} records for {tv_symbol}")
                total_imported += records
                
                time.sleep(0.5)  # Rate limiting
                
            except Exception as e:
                logger.error(f"    ❌ Error importing {fred_symbol}: {e}")
                continue
        
        logger.success(f"📥 FRED Import Complete! {total_imported} total records imported")
        logger.info("")
        
        # Show updated coverage
        check_database_coverage()
        
    except ImportError:
        logger.warning("fredapi not installed. Install with: pip install fredapi")
    except Exception as e:
        logger.error(f"Error importing from FRED: {e}")


if __name__ == '__main__':
    main()

