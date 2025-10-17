"""
SOFR Futures Collector - Fetches specific contract months for SOFR futures.
This enables SOFR forward curve construction from futures prices.
"""

import yfinance as yf
from datetime import date, timedelta, datetime
from typing import List, Dict, Optional, Tuple
from loguru import logger
from sqlalchemy.exc import IntegrityError

from src.database.connection import DatabaseManager
from src.database.models import FuturesPrice, DataCollectionLog
from src.utils.config import Config


class SOFRFuturesCollector:
    """Collects SOFR futures contract data for forward curve construction."""

    # CME month codes (SOFR futures trade monthly)
    MONTH_CODES = {
        'F': ('January', 1),
        'G': ('February', 2),
        'H': ('March', 3),
        'J': ('April', 4),
        'K': ('May', 5),
        'M': ('June', 6),
        'N': ('July', 7),
        'Q': ('August', 8),
        'U': ('September', 9),
        'V': ('October', 10),
        'X': ('November', 11),
        'Z': ('December', 12),
    }

    def __init__(self):
        self.config = Config()
        self.db_manager = DatabaseManager()
        
        # SOFR futures symbols
        self.futures_symbols = {
            'SR1': '1-Month SOFR Futures',
            'SR3': '3-Month SOFR Futures',
        }

    def generate_contract_codes(
        self, 
        base_symbol: str, 
        num_contracts: int = 12
    ) -> List[Tuple[str, str, date]]:
        """
        Generate contract codes for future months.
        
        Args:
            base_symbol: Base symbol (e.g., 'SR1' or 'SR3')
            num_contracts: Number of future contracts to generate
            
        Returns:
            List of tuples: (contract_code, contract_month, expiration_date)
            e.g., [('SR1Z25', 'Z25', datetime(2025, 12, 15)), ...]
        """
        contracts = []
        current_date = datetime.now().date()
        
        # Generate monthly contracts going forward
        for i in range(num_contracts):
            # Calculate target month
            target_date = current_date + timedelta(days=30 * i)
            target_year = target_date.year
            target_month = target_date.month
            
            # Skip current month, start from next month
            if i == 0:
                target_date = current_date + timedelta(days=30)
                target_year = target_date.year
                target_month = target_date.month
            
            # Get month code
            month_code = None
            for code, (name, m) in self.MONTH_CODES.items():
                if m == target_month:
                    month_code = code
                    break
            
            if not month_code:
                continue
            
            # Build contract code
            year_code = str(target_year)[-2:]  # Last 2 digits
            contract_code = f"{base_symbol}{month_code}{year_code}"
            contract_month = f"{month_code}{year_code}"
            
            # SOFR futures expire on the 3rd Wednesday of the contract month
            expiration_date = self._calculate_expiration_date(target_year, target_month)
            
            contracts.append((contract_code, contract_month, expiration_date))
        
        return contracts

    def _calculate_expiration_date(self, year: int, month: int) -> date:
        """
        Calculate SOFR futures expiration date.
        SOFR futures expire on the 3rd Wednesday of the contract month.
        """
        # Find first day of month
        first_day = date(year, month, 1)
        
        # Find first Wednesday
        days_until_wednesday = (2 - first_day.weekday()) % 7
        first_wednesday = first_day + timedelta(days=days_until_wednesday)
        
        # Third Wednesday is 2 weeks after first Wednesday
        third_wednesday = first_wednesday + timedelta(weeks=2)
        
        return third_wednesday

    def collect_sofr_futures(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        num_contracts: int = 12
    ) -> int:
        """
        Collect SOFR futures contract data for forward curve construction.
        
        Args:
            start_date: Start date for historical data
            end_date: End date for historical data
            num_contracts: Number of future contracts to track per symbol
            
        Returns:
            Number of records collected
        """
        records_collected = 0
        session = self.db_manager.get_session()
        
        if start_date is None:
            # Get data from 2 years ago
            start_date = date.today() - timedelta(days=730)
        if end_date is None:
            end_date = date.today()
        
        logger.info(f"Collecting SOFR futures data from {start_date} to {end_date}")
        logger.info(f"Tracking {num_contracts} contracts per symbol")
        
        for base_symbol, name in self.futures_symbols.items():
            logger.info(f"Processing {base_symbol} ({name})")
            
            # Generate contract codes
            contracts = self.generate_contract_codes(base_symbol, num_contracts)
            
            for contract_code, contract_month, expiration_date in contracts:
                logger.info(f"  Fetching {contract_code} (expires ~{expiration_date})")
                
                try:
                    # Try different Yahoo Finance formats
                    symbols_to_try = [
                        f"{contract_code}=F",       # SR1Z25=F
                        contract_code,              # SR1Z25
                    ]
                    
                    df = None
                    for symbol_format in symbols_to_try:
                        try:
                            df = yf.download(
                                symbol_format, 
                                start=start_date, 
                                end=end_date, 
                                interval="1d",
                                progress=False
                            )
                            if not df.empty:
                                logger.info(f"    Found data using format: {symbol_format}")
                                break
                        except Exception as e:
                            continue
                    
                    if df is None or df.empty:
                        logger.warning(f"    No data for {contract_code}")
                        continue
                    
                    logger.info(f"    Downloaded {len(df)} days of data")
                    
                    # Process each row
                    for idx, row in df.iterrows():
                        trade_date = idx.date()
                        
                        # Skip if after expiration
                        if trade_date > expiration_date:
                            continue
                        
                        # Check if record already exists
                        existing = session.query(FuturesPrice).filter_by(
                            date=trade_date,
                            contract_symbol=base_symbol,
                            contract_month=contract_month,
                            source='YAHOO_FINANCE'
                        ).first()
                        
                        if existing:
                            # Update existing record
                            existing.settlement_price = float(row['Close'])
                            existing.prior_settlement = float(row['Open'])
                            existing.change = float(row['Close'] - row['Open'])
                            existing.high = float(row['High'])
                            existing.low = float(row['Low'])
                            existing.expiration_date = expiration_date
                            existing.updated_at = datetime.utcnow()
                        else:
                            # Create new record
                            record = FuturesPrice(
                                date=trade_date,
                                contract_symbol=base_symbol,
                                contract_month=contract_month,
                                expiration_date=expiration_date,
                                settlement_price=float(row['Close']),
                                prior_settlement=float(row['Open']),
                                change=float(row['Close'] - row['Open']),
                                high=float(row['High']),
                                low=float(row['Low']),
                                source='YAHOO_FINANCE'
                            )
                            session.add(record)
                            records_collected += 1
                    
                    # Commit after each contract
                    session.commit()
                    logger.info(f"    Saved data for {contract_code}")
                    
                except Exception as e:
                    session.rollback()
                    logger.error(f"    Failed to collect {contract_code}: {e}")
                    continue
        
        # Log collection
        log_entry = DataCollectionLog(
            collection_date=datetime.utcnow(),
            source='YAHOO_FINANCE',
            data_type='sofr_futures',
            status='SUCCESS',
            records_collected=records_collected,
            start_time=datetime.utcnow() - timedelta(seconds=1),
            end_time=datetime.utcnow()
        )
        session.add(log_entry)
        session.commit()
        session.close()
        
        logger.info(f"SOFR futures collection complete: {records_collected} new records")
        return records_collected

    def collect_all(self):
        """Entry point for scheduled collection."""
        # Collect last 2 years of data, tracking 12 contracts out
        start_date = date.today() - timedelta(days=730)
        return self.collect_sofr_futures(start_date=start_date, num_contracts=12)


if __name__ == "__main__":
    collector = SOFRFuturesCollector()
    
    # Test: generate contracts for SR1
    print("\n=== Testing Contract Code Generation ===")
    contracts = collector.generate_contract_codes('SR1', num_contracts=12)
    print(f"Generated {len(contracts)} contracts:")
    for code, month, exp_date in contracts[:6]:  # Show first 6
        print(f"  {code} (month: {month}, expires: {exp_date})")
    
    print("\n=== Starting SOFR Futures Collection ===")
    collector.collect_all()

