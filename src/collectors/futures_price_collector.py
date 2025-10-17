"""
Treasury Futures Price Collector
Collects daily OHLCV data for Treasury futures contracts
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List
from loguru import logger
from sqlalchemy.exc import IntegrityError

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from src.database.connection import DatabaseManager
from src.database.models import FuturesPrice, DataCollectionLog
from src.utils.config import Config


class FuturesPriceCollector:
    """Collector for Treasury futures price data using yfinance"""
    
    # Treasury futures contracts
    FUTURES_CONTRACTS = {
        'ZT=F': '2Y T-Note Futures',
        'ZF=F': '5Y T-Note Futures',
        'ZN=F': '10Y T-Note Futures',
        'ZB=F': '30Y T-Bond Futures',
        'UB=F': 'Ultra T-Bond Futures',
        'TN=F': 'Ultra 10Y T-Note Futures',
    }
    
    def __init__(self):
        """Initialize the collector"""
        self.config = Config()
        self.db_manager = DatabaseManager()
    
    def collect_futures_prices(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        symbols: Optional[List[str]] = None
    ) -> int:
        """
        Collect futures price data for specified contracts.
        
        Args:
            start_date: Start date for data collection
            end_date: End date for data collection
            symbols: List of futures symbols (default: all)
            
        Returns:
            Number of records collected
        """
        if not end_date:
            end_date = date.today()
        
        if not start_date:
            start_date = end_date - timedelta(days=365)  # Default 1 year
        
        if not symbols:
            symbols = list(self.FUTURES_CONTRACTS.keys())
        
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            logger.info(f"Collecting futures prices from {start_date} to {end_date}")
            
            session = self.db_manager.get_session()
            
            for symbol in symbols:
                contract_name = self.FUTURES_CONTRACTS.get(symbol, symbol)
                logger.info(f"Fetching {symbol} ({contract_name})")
                
                try:
                    # Download data from yfinance
                    ticker = yf.Ticker(symbol)
                    df = ticker.history(
                        start=start_date.strftime('%Y-%m-%d'),
                        end=(end_date + timedelta(days=1)).strftime('%Y-%m-%d'),
                        interval='1d'
                    )
                    
                    if df.empty:
                        logger.warning(f"No data returned for {symbol}")
                        continue
                    
                    logger.info(f"Downloaded {len(df)} days of data for {symbol}")
                    
                    # Process each row
                    for idx, row in df.iterrows():
                        trade_date = idx.date()
                        
                        # Check if record already exists
                        existing = session.query(FuturesPrice).filter_by(
                            date=trade_date,
                            contract_symbol=symbol,
                            contract_month='CONTINUOUS',  # Generic contract
                            source='YAHOO_FINANCE'
                        ).first()
                        
                        if existing:
                            # Update existing record
                            existing.settlement_price = float(row['Close'])
                            existing.prior_settlement = float(row['Open'])
                            existing.change = float(row['Close'] - row['Open'])
                            existing.high = float(row['High'])
                            existing.low = float(row['Low'])
                            existing.updated_at = datetime.utcnow()
                        else:
                            # Create new record
                            record = FuturesPrice(
                                date=trade_date,
                                contract_symbol=symbol,
                                contract_month='CONTINUOUS',  # Generic continuous contract
                                expiration_date=None,
                                settlement_price=float(row['Close']),
                                prior_settlement=float(row['Open']),
                                change=float(row['Close'] - row['Open']),
                                high=float(row['High']),
                                low=float(row['Low']),
                                source='YAHOO_FINANCE'
                            )
                            session.add(record)
                            records_collected += 1
                    
                    # Commit after each symbol
                    session.commit()
                    logger.info(f"Saved data for {symbol}")
                    
                except Exception as e:
                    logger.error(f"Error collecting {symbol}: {e}")
                    session.rollback()
                    continue
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='YAHOO_FINANCE',
                data_type='futures_prices',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"Futures price collection complete: {records_collected} new records")
            return records_collected
            
        except Exception as e:
            logger.error(f"Futures price collection failed: {e}")
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='YAHOO_FINANCE',
                data_type='futures_prices',
                status='ERROR',
                records_collected=0,
                error_message=str(e),
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            return 0
    
    def collect_all(self, backfill_years: int = 10) -> Dict[str, int]:
        """
        Collect all Treasury futures price data.
        
        Args:
            backfill_years: Number of years to backfill
            
        Returns:
            Dictionary with collection statistics
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=365 * backfill_years)
        
        logger.info(f"Starting futures price collection (backfill from {start_date})")
        
        records = self.collect_futures_prices(start_date=start_date, end_date=end_date)
        
        return {'futures_prices': records}


if __name__ == '__main__':
    collector = FuturesPriceCollector()
    results = collector.collect_all(backfill_years=10)
    print(f"\n✅ Collection Summary:")
    print(f"   Futures Prices: {results['futures_prices']} records")

