"""FRED (Federal Reserve Economic Data) API collector."""

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Any
import time

from fredapi import Fred
from loguru import logger
from sqlalchemy.exc import IntegrityError

from src.database.connection import get_db_manager
from src.database.models import TreasuryRate, FedRate, EconomicIndicator, DataCollectionLog
from src.utils.config import get_config


class FREDCollector:
    """Collector for FRED API data."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize FRED collector.
        
        Args:
            api_key: FRED API key. If None, reads from config.
        """
        self.config = get_config()
        
        if api_key is None:
            api_key = self.config.get('apis.fred.api_key')
        
        if not api_key or api_key == 'YOUR_FRED_API_KEY_HERE':
            raise ValueError(
                "FRED API key not configured. "
                "Get a free key from https://fred.stlouisfed.org/docs/api/api_key.html "
                "and add it to config.yaml"
            )
        
        self.fred = Fred(api_key=api_key)
        self.db_manager = get_db_manager()
        self.retry_attempts = self.config.get('collection.retry_attempts', 3)
        self.retry_delay = self.config.get('collection.retry_delay', 5)
    
    def _fetch_series_with_retry(
        self, 
        series_id: str, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Any:
        """Fetch FRED series with retry logic.
        
        Args:
            series_id: FRED series ID.
            start_date: Start date for data.
            end_date: End date for data.
            
        Returns:
            Pandas Series with data.
        """
        for attempt in range(self.retry_attempts):
            try:
                kwargs = {}
                if start_date:
                    kwargs['observation_start'] = start_date
                if end_date:
                    kwargs['observation_end'] = end_date
                
                data = self.fred.get_series(series_id, **kwargs)
                return data
            except Exception as e:
                logger.warning(
                    f"Attempt {attempt + 1}/{self.retry_attempts} failed for {series_id}: {e}"
                )
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise
    
    def collect_treasury_rates(
        self, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Collect Treasury rates from FRED.
        
        Args:
            start_date: Start date for backfill.
            end_date: End date for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            treasury_series = self.config.get('fred_series.treasury_rates', {})
            
            if not treasury_series:
                logger.warning("No treasury series configured")
                return 0
            
            session = self.db_manager.get_session()
            
            for series_id, maturity_name in treasury_series.items():
                try:
                    logger.info(f"Fetching {series_id} ({maturity_name})")
                    data = self._fetch_series_with_retry(series_id, start_date, end_date)
                    
                    # Extract maturity code (e.g., "1-Month" -> "1M")
                    maturity = self._parse_maturity(maturity_name)
                    
                    for dt, rate in data.items():
                        if rate is not None and not pd.isna(rate):
                            try:
                                record = TreasuryRate(
                                    date=dt.date(),
                                    maturity=maturity,
                                    rate=float(rate),
                                    source='FRED'
                                )
                                session.add(record)
                                records_collected += 1
                            except IntegrityError:
                                # Record already exists
                                session.rollback()
                    
                    session.commit()
                    logger.info(f"Collected {len(data)} records for {series_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to collect {series_id}: {e}")
                    session.rollback()
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='treasury_rates',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"Treasury rates collection complete: {records_collected} records")
            return records_collected
            
        except Exception as e:
            logger.error(f"Treasury rates collection failed: {e}")
            # Log failed collection
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='treasury_rates',
                status='FAILED',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow(),
                error_message=str(e)
            )
            session.add(log_entry)
            session.commit()
            session.close()
            raise
    
    def collect_policy_rates(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Collect policy rates (Fed Funds, SOFR, etc.) from FRED.
        
        Args:
            start_date: Start date for backfill.
            end_date: End date for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            policy_series = self.config.get('fred_series.policy_rates', {})
            
            if not policy_series:
                logger.warning("No policy rate series configured")
                return 0
            
            session = self.db_manager.get_session()
            
            for series_id, rate_name in policy_series.items():
                try:
                    logger.info(f"Fetching {series_id} ({rate_name})")
                    data = self._fetch_series_with_retry(series_id, start_date, end_date)
                    
                    # Use series_id as rate_type
                    rate_type = series_id
                    
                    for dt, rate in data.items():
                        if rate is not None and not pd.isna(rate):
                            try:
                                record = FedRate(
                                    date=dt.date(),
                                    rate_type=rate_type,
                                    rate=float(rate),
                                    source='FRED'
                                )
                                session.add(record)
                                records_collected += 1
                            except IntegrityError:
                                session.rollback()
                    
                    session.commit()
                    logger.info(f"Collected {len(data)} records for {series_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to collect {series_id}: {e}")
                    session.rollback()
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='policy_rates',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"Policy rates collection complete: {records_collected} records")
            return records_collected
            
        except Exception as e:
            logger.error(f"Policy rates collection failed: {e}")
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='policy_rates',
                status='FAILED',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow(),
                error_message=str(e)
            )
            session.add(log_entry)
            session.commit()
            session.close()
            raise
    
    def collect_sofr_rates(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Collect SOFR term averages from FRED.
        
        Args:
            start_date: Start date for backfill.
            end_date: End date for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            sofr_series = self.config.get('fred_series.sofr_rates', {})
            
            if not sofr_series:
                logger.warning("No SOFR series configured")
                return 0
            
            session = self.db_manager.get_session()
            
            for series_id, maturity_name in sofr_series.items():
                try:
                    logger.info(f"Fetching {series_id} ({maturity_name})")
                    data = self._fetch_series_with_retry(series_id, start_date, end_date)
                    
                    # Use maturity_name directly (e.g., "30-Day" -> "30D")
                    maturity = maturity_name.replace('-Day', 'D')
                    
                    for dt, rate in data.items():
                        if rate is not None and not pd.isna(rate):
                            try:
                                record = TreasuryRate(
                                    date=dt.date(),
                                    maturity=maturity,
                                    rate=float(rate),
                                    source='FRED_SOFR'
                                )
                                session.add(record)
                                records_collected += 1
                            except IntegrityError:
                                # Record already exists
                                session.rollback()
                    
                    session.commit()
                    logger.info(f"Collected {len(data)} records for {series_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to collect {series_id}: {e}")
                    session.rollback()
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='sofr_rates',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"SOFR rates collection complete: {records_collected} records")
            return records_collected
            
        except Exception as e:
            logger.error(f"SOFR rates collection failed: {e}")
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='sofr_rates',
                status='FAILED',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow(),
                error_message=str(e)
            )
            session.add(log_entry)
            session.commit()
            session.close()
            raise
    
    def collect_economic_indicators(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Collect economic indicators from FRED.
        
        Args:
            start_date: Start date for backfill.
            end_date: End date for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            indicator_series = self.config.get('fred_series.economic_indicators', {})
            
            if not indicator_series:
                logger.warning("No economic indicator series configured")
                return 0
            
            session = self.db_manager.get_session()
            
            for series_id, indicator_name in indicator_series.items():
                try:
                    logger.info(f"Fetching {series_id} ({indicator_name})")
                    data = self._fetch_series_with_retry(series_id, start_date, end_date)
                    
                    for dt, value in data.items():
                        if value is not None and not pd.isna(value):
                            try:
                                record = EconomicIndicator(
                                    date=dt.date(),
                                    indicator_name=indicator_name,
                                    indicator_code=series_id,
                                    value=float(value),
                                    unit=self._get_unit(series_id),
                                    source='FRED'
                                )
                                session.add(record)
                                records_collected += 1
                            except IntegrityError:
                                session.rollback()
                    
                    session.commit()
                    logger.info(f"Collected {len(data)} records for {series_id}")
                    
                except Exception as e:
                    logger.error(f"Failed to collect {series_id}: {e}")
                    session.rollback()
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='economic_indicators',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"Economic indicators collection complete: {records_collected} records")
            return records_collected
            
        except Exception as e:
            logger.error(f"Economic indicators collection failed: {e}")
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='FRED',
                data_type='economic_indicators',
                status='FAILED',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow(),
                error_message=str(e)
            )
            session.add(log_entry)
            session.commit()
            session.close()
            raise
    
    def collect_all(
        self,
        backfill_years: Optional[int] = None
    ) -> Dict[str, int]:
        """Collect all configured data from FRED.
        
        Args:
            backfill_years: Number of years to backfill. If None, uses config.
            
        Returns:
            Dictionary with collection counts by data type.
        """
        if backfill_years is None:
            backfill_years = self.config.get('collection.backfill_years', 10)
        
        start_date = datetime.now().date() - timedelta(days=backfill_years * 365)
        
        logger.info(f"Starting FRED data collection (backfill from {start_date})")
        
        results = {}
        results['treasury_rates'] = self.collect_treasury_rates(start_date=start_date)
        results['policy_rates'] = self.collect_policy_rates(start_date=start_date)
        results['sofr_rates'] = self.collect_sofr_rates(start_date=start_date)
        results['economic_indicators'] = self.collect_economic_indicators(start_date=start_date)
        
        total = sum(results.values())
        logger.info(f"FRED collection complete: {total} total records")
        
        return results
    
    @staticmethod
    def _parse_maturity(maturity_name: str) -> str:
        """Parse maturity name to standard code.
        
        Args:
            maturity_name: Maturity name like "1-Month", "10-Year"
            
        Returns:
            Standard maturity code like "1M", "10Y"
        """
        import re
        
        # Extract number and unit
        match = re.match(r'(\d+)-(Month|Year)', maturity_name)
        if match:
            num, unit = match.groups()
            code = 'M' if unit == 'Month' else 'Y'
            return f"{num}{code}"
        
        return maturity_name
    
    @staticmethod
    def _get_unit(series_id: str) -> str:
        """Get unit for series.
        
        Args:
            series_id: FRED series ID
            
        Returns:
            Unit string
        """
        # Simple mapping of common series
        if 'CPI' in series_id:
            return 'index'
        elif 'UNRATE' in series_id:
            return 'percentage'
        elif 'GDP' in series_id:
            return 'billions'
        elif 'RATE' in series_id or 'FUND' in series_id:
            return 'percentage'
        else:
            return 'unknown'


# Add pandas import
import pandas as pd


def main():
    """Main function for testing."""
    from loguru import logger
    import sys
    
    # Configure logging
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    
    try:
        collector = FREDCollector()
        results = collector.collect_all()
        logger.info(f"Collection results: {results}")
    except Exception as e:
        logger.error(f"Collection failed: {e}")
        raise


if __name__ == '__main__':
    main()

