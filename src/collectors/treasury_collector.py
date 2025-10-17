"""US Treasury Department data collector."""

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional
import time
import xml.etree.ElementTree as ET

import requests
from loguru import logger
from sqlalchemy.exc import IntegrityError

from src.database.connection import get_db_manager
from src.database.models import TreasuryRate, DataCollectionLog
from src.utils.config import get_config


class TreasuryCollector:
    """Collector for US Treasury Department data."""
    
    # Treasury XML feed URL
    DAILY_RATES_URL = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml"
    
    # Maturity mapping
    MATURITY_MAP = {
        'BC_1MONTH': '1M',
        'BC_3MONTH': '3M',
        'BC_6MONTH': '6M',
        'BC_1YEAR': '1Y',
        'BC_2YEAR': '2Y',
        'BC_3YEAR': '3Y',
        'BC_5YEAR': '5Y',
        'BC_7YEAR': '7Y',
        'BC_10YEAR': '10Y',
        'BC_20YEAR': '20Y',
        'BC_30YEAR': '30Y',
    }
    
    def __init__(self):
        """Initialize Treasury collector."""
        self.config = get_config()
        self.db_manager = get_db_manager()
        self.base_url = self.config.get(
            'apis.treasury.base_url',
            'https://home.treasury.gov/resource-center/data-chart-center/interest-rates'
        )
        self.retry_attempts = self.config.get('collection.retry_attempts', 3)
        self.retry_delay = self.config.get('collection.retry_delay', 5)
    
    def _fetch_daily_rates_xml(self, year: int) -> Optional[str]:
        """Fetch daily Treasury yield curve XML for a specific year.
        
        Args:
            year: Year to fetch.
            
        Returns:
            XML content as string, or None if failed.
        """
        url = f"{self.DAILY_RATES_URL}?data=daily_treasury_yield_curve&field_tdr_date_value={year}"
        
        for attempt in range(self.retry_attempts):
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                return response.text
            except Exception as e:
                logger.warning(
                    f"Attempt {attempt + 1}/{self.retry_attempts} failed for year {year}: {e}"
                )
                if attempt < self.retry_attempts - 1:
                    time.sleep(self.retry_delay)
                else:
                    logger.error(f"Failed to fetch Treasury data for {year}")
                    return None
    
    def _parse_treasury_xml(self, xml_content: str) -> List[Dict]:
        """Parse Treasury XML content.
        
        Args:
            xml_content: XML string content.
            
        Returns:
            List of dictionaries with parsed rate data.
        """
        rates = []
        
        try:
            root = ET.fromstring(xml_content)
            
            # Find all entry elements
            for entry in root.findall('.//{http://www.w3.org/2005/Atom}entry'):
                try:
                    # Extract date
                    date_elem = entry.find('.//{http://www.w3.org/2005/Atom}content/'
                                          '{http://schemas.microsoft.com/ado/2007/08/dataservices/metadata}properties/'
                                          '{http://schemas.microsoft.com/ado/2007/08/dataservices}NEW_DATE')
                    
                    if date_elem is None or date_elem.text is None:
                        continue
                    
                    rate_date = datetime.strptime(date_elem.text[:10], '%Y-%m-%d').date()
                    
                    # Extract all maturity rates
                    properties = entry.find('.//{http://www.w3.org/2005/Atom}content/'
                                           '{http://schemas.microsoft.com/ado/2007/08/dataservices/metadata}properties')
                    
                    if properties is None:
                        continue
                    
                    for maturity_code, maturity_name in self.MATURITY_MAP.items():
                        rate_elem = properties.find(f'{{http://schemas.microsoft.com/ado/2007/08/dataservices}}{maturity_code}')
                        
                        if rate_elem is not None and rate_elem.text:
                            try:
                                rate_value = float(rate_elem.text)
                                rates.append({
                                    'date': rate_date,
                                    'maturity': maturity_name,
                                    'rate': rate_value
                                })
                            except (ValueError, TypeError):
                                continue
                
                except Exception as e:
                    logger.warning(f"Failed to parse entry: {e}")
                    continue
        
        except Exception as e:
            logger.error(f"Failed to parse XML: {e}")
        
        return rates
    
    def collect_daily_rates(
        self,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None
    ) -> int:
        """Collect daily Treasury yield curve rates.
        
        Args:
            start_year: Start year for collection.
            end_year: End year for collection.
            
        Returns:
            Number of records collected.
        """
        start_time = datetime.utcnow()
        records_collected = 0
        
        try:
            # Default to last 10 years if not specified
            if end_year is None:
                end_year = datetime.now().year
            if start_year is None:
                backfill_years = self.config.get('collection.backfill_years', 10)
                start_year = end_year - backfill_years
            
            logger.info(f"Collecting Treasury rates from {start_year} to {end_year}")
            
            session = self.db_manager.get_session()
            
            for year in range(start_year, end_year + 1):
                logger.info(f"Fetching Treasury data for year {year}")
                
                xml_content = self._fetch_daily_rates_xml(year)
                if xml_content is None:
                    continue
                
                rates = self._parse_treasury_xml(xml_content)
                logger.info(f"Parsed {len(rates)} rate records for {year}")
                
                for rate_data in rates:
                    try:
                        record = TreasuryRate(
                            date=rate_data['date'],
                            maturity=rate_data['maturity'],
                            rate=rate_data['rate'],
                            source='TREASURY'
                        )
                        session.add(record)
                        records_collected += 1
                    except IntegrityError:
                        # Record already exists
                        session.rollback()
                
                session.commit()
                
                # Be nice to the server
                time.sleep(1)
            
            # Log successful collection
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='TREASURY',
                data_type='daily_rates',
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
            session = self.db_manager.get_session()
            log_entry = DataCollectionLog(
                collection_date=datetime.utcnow(),
                source='TREASURY',
                data_type='daily_rates',
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
        """Collect all Treasury data.
        
        Args:
            backfill_years: Number of years to backfill.
            
        Returns:
            Dictionary with collection counts.
        """
        if backfill_years is None:
            backfill_years = self.config.get('collection.backfill_years', 10)
        
        end_year = datetime.now().year
        start_year = end_year - backfill_years
        
        logger.info(f"Starting Treasury data collection ({start_year}-{end_year})")
        
        records = self.collect_daily_rates(start_year=start_year, end_year=end_year)
        
        return {'daily_rates': records}


def main():
    """Main function for testing."""
    from loguru import logger
    import sys
    
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    
    try:
        collector = TreasuryCollector()
        results = collector.collect_all(backfill_years=2)  # Test with 2 years
        logger.info(f"Collection results: {results}")
    except Exception as e:
        logger.error(f"Collection failed: {e}")
        raise


if __name__ == '__main__':
    main()

