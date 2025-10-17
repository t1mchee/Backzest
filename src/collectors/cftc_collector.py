"""CFTC (Commodity Futures Trading Commission) Commitments of Traders data collector."""

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional
import time

import requests
import pandas as pd
from loguru import logger
from sqlalchemy.exc import IntegrityError

from src.database.connection import get_db_manager
from src.database.models import CFTCCOT, DataCollectionLog
from src.utils.config import get_config


class CFTCCollector:
    """Collector for CFTC Commitments of Traders data."""
    
    # CFTC SODA API endpoint
    BASE_URL = "https://publicreporting.cftc.gov/resource"
    
    # Interest rate futures contracts to track
    INTEREST_RATE_CONTRACTS = {
        '042601': 'EURODOLLAR',
        '13874+': 'FED FUNDS 30 DAY',
        '111742': '3-MONTH SOFR',
        '020601': '2-YEAR T-NOTE',
        '021601': '5-YEAR T-NOTE',
        '043602': '10-YEAR T-NOTE',
        '020604': 'TREASURY BOND',
        '044601': 'ULTRA T-BOND',
    }
    
    def __init__(self):
        """Initialize CFTC collector."""
        self.config = get_config()
        self.db_manager = get_db_manager()
        self.base_url = self.config.get(
            'apis.cftc.base_url',
            'https://publicreporting.cftc.gov/resource'
        )
        self.retry_attempts = self.config.get('collection.retry_attempts', 3)
        self.retry_delay = self.config.get('collection.retry_delay', 5)
    
    def _fetch_cot_data(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 10000
    ) -> Optional[List[Dict]]:
        """Fetch COT data from CFTC SODA API.
        
        Args:
            start_date: Start date for data.
            end_date: End date for data.
            limit: Maximum records to fetch.
            
        Returns:
            List of COT records, or None if failed.
        """
        # Use Traders in Financial Futures (TFF) endpoint for interest rate futures
        url = f"{self.base_url}/gpe5-46if.json"
        
        params = {
            '$limit': limit,
            '$order': 'report_date_as_yyyy_mm_dd DESC',
            # Filter for interest rate futures only
            '$where': "commodity_subgroup_name='Interest Rates - U.S. Treasury'"
        }
        
        if start_date:
            params['$where'] += f" AND report_date_as_yyyy_mm_dd >= '{start_date}'"
        if end_date:
            params['$where'] += f" AND report_date_as_yyyy_mm_dd <= '{end_date}'"
        
        for attempt in range(self.retry_attempts):
            try:
                response = requests.get(url, params=params, timeout=60)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.warning(
                    f"Attempt {attempt + 1}/{self.retry_attempts} failed: {e}"
                )
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
                else:
                    logger.error(f"Failed to fetch CFTC data")
                    return None
    
    def _parse_cot_record(self, record: Dict) -> Optional[Dict]:
        """Parse a single COT record from TFF (Traders in Financial Futures) format.
        
        Args:
            record: Raw COT record from API.
            
        Returns:
            Parsed record dictionary, or None if not relevant.
        """
        try:
            # Get contract name from the record
            contract_name = record.get('contract_market_name', '')
            commodity_name = record.get('commodity_name', '')
            
            # Parse date
            date_str = record.get('report_date_as_yyyy_mm_dd')
            if not date_str:
                return None
            # Handle ISO format datetime
            if 'T' in date_str:
                date_str = date_str.split('T')[0]
            report_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Helper function to safely parse integer
            def safe_int(value):
                if value is None or value == '':
                    return None
                try:
                    return int(float(str(value).replace(',', '')))
                except (ValueError, TypeError):
                    return None
            
            # Helper function to safely parse float
            def safe_float(value):
                if value is None or value == '':
                    return None
                try:
                    return float(str(value).replace(',', ''))
                except (ValueError, TypeError):
                    return None
            
            # TFF format has different categories: Dealer, Asset Manager, Leveraged Money, Other
            # We'll aggregate these to match our schema
            dealer_long = safe_int(record.get('dealer_positions_long_all', 0)) or 0
            asset_mgr_long = safe_int(record.get('asset_mgr_positions_long', 0)) or 0
            lev_money_long = safe_int(record.get('lev_money_positions_long', 0)) or 0
            
            dealer_short = safe_int(record.get('dealer_positions_short_all', 0)) or 0
            asset_mgr_short = safe_int(record.get('asset_mgr_positions_short', 0)) or 0
            lev_money_short = safe_int(record.get('lev_money_positions_short', 0)) or 0
            
            # Non-commercial = Leveraged Money (speculators)
            noncomm_long = lev_money_long
            noncomm_short = lev_money_short
            
            # Commercial = Dealer + Asset Managers
            comm_long = dealer_long + asset_mgr_long
            comm_short = dealer_short + asset_mgr_short
            
            return {
                'report_date': report_date,
                'contract_name': f"{contract_name} - {commodity_name}".strip(' -'),
                'cftc_contract_code': record.get('cftc_contract_market_code', ''),
                'open_interest_all': safe_int(record.get('open_interest_all')),
                'noncomm_positions_long': noncomm_long,
                'noncomm_positions_short': noncomm_short,
                'noncomm_positions_spreading': safe_int(record.get('lev_money_positions_spread')),
                'comm_positions_long': comm_long,
                'comm_positions_short': comm_short,
                'total_reportable_long': safe_int(record.get('tot_rept_positions_long_all')),
                'total_reportable_short': safe_int(record.get('tot_rept_positions_short')),
                'nonreportable_positions_long': safe_int(record.get('nonrept_positions_long_all')),
                'nonreportable_positions_short': safe_int(record.get('nonrept_positions_short_all')),
                'change_noncomm_long': safe_int(record.get('change_in_lev_money_long')),
                'change_noncomm_short': safe_int(record.get('change_in_lev_money_short')),
                'pct_noncomm_long': safe_float(record.get('pct_of_oi_lev_money_long')),
                'pct_noncomm_short': safe_float(record.get('pct_of_oi_lev_money_short')),
            }
        
        except Exception as e:
            logger.warning(f"Failed to parse COT record: {e}")
            return None
    
    def collect_cot_reports(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """Collect COT reports for interest rate futures.
        
        Args:
            start_date: Start date for collection.
            end_date: End date for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            logger.info(f"Collecting CFTC COT data from {start_date} to {end_date}")
            
            raw_data = self._fetch_cot_data(start_date=start_date, end_date=end_date)
            
            if raw_data is None:
                logger.warning("No data returned from CFTC API")
                return 0
            
            logger.info(f"Fetched {len(raw_data)} raw COT records")
            
            session = self.db_manager.get_session()
            batch_size = 50  # Commit in smaller batches
            batch_count = 0
            
            for raw_record in raw_data:
                parsed = self._parse_cot_record(raw_record)
                
                if parsed is None:
                    continue
                
                # Check if record already exists
                existing = session.query(CFTCCOT).filter_by(
                    report_date=parsed['report_date'],
                    contract_name=parsed['contract_name'],
                    source='CFTC'
                ).first()
                
                if existing:
                    # Skip duplicate
                    continue
                
                record = CFTCCOT(
                    report_date=parsed['report_date'],
                    contract_name=parsed['contract_name'],
                    cftc_contract_code=parsed['cftc_contract_code'],
                    open_interest_all=parsed['open_interest_all'],
                    noncomm_positions_long=parsed['noncomm_positions_long'],
                    noncomm_positions_short=parsed['noncomm_positions_short'],
                    noncomm_positions_spreading=parsed['noncomm_positions_spreading'],
                    comm_positions_long=parsed['comm_positions_long'],
                    comm_positions_short=parsed['comm_positions_short'],
                    total_reportable_long=parsed['total_reportable_long'],
                    total_reportable_short=parsed['total_reportable_short'],
                    nonreportable_positions_long=parsed['nonreportable_positions_long'],
                    nonreportable_positions_short=parsed['nonreportable_positions_short'],
                    change_noncomm_long=parsed['change_noncomm_long'],
                    change_noncomm_short=parsed['change_noncomm_short'],
                    pct_noncomm_long=parsed['pct_noncomm_long'],
                    pct_noncomm_short=parsed['pct_noncomm_short'],
                    source='CFTC'
                )
                session.add(record)
                records_collected += 1
                batch_count += 1
                
                # Commit in batches
                if batch_count >= batch_size:
                    session.commit()
                    batch_count = 0
            
            # Commit any remaining records
            session.commit()
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='CFTC',
                data_type='cot_reports',
                status='SUCCESS',
                records_collected=records_collected,
                start_time=start_time,
                end_time=datetime.utcnow()
            )
            session.add(log_entry)
            session.commit()
            session.close()
            
            logger.info(f"CFTC COT collection complete: {records_collected} records")
            return records_collected
            
        except Exception as e:
            logger.error(f"CFTC COT collection failed: {e}")
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='CFTC',
                data_type='cot_reports',
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
    
    def collect_all(self, backfill_years: Optional[int] = None) -> Dict[str, int]:
        """Collect all CFTC data.
        
        Args:
            backfill_years: Number of years to backfill.
            
        Returns:
            Dictionary with collection counts.
        """
        if backfill_years is None:
            backfill_years = self.config.get('collection.backfill_years', 10)
        
        start_date = datetime.now().date() - timedelta(days=backfill_years * 365)
        
        logger.info(f"Starting CFTC data collection (backfill from {start_date})")
        
        records = self.collect_cot_reports(start_date=start_date)
        
        return {'cot_reports': records}


def main():
    """Main function for testing."""
    from loguru import logger
    import sys
    
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    
    try:
        collector = CFTCCollector()
        results = collector.collect_all(backfill_years=1)  # Test with 1 year
        logger.info(f"Collection results: {results}")
    except Exception as e:
        logger.error(f"Collection failed: {e}")
        raise


if __name__ == '__main__':
    main()

