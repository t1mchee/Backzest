"""
Forward Curve Collector - Fetches specific contract months for Treasury futures.
This enables forward curve construction showing term structure at any point in time.
"""

import yfinance as yf
from datetime import date, timedelta, datetime
from typing import List, Dict, Optional, Tuple
from loguru import logger
from sqlalchemy.exc import IntegrityError

from src.database.connection import DatabaseManager
from src.database.models import FuturesPrice, DataCollectionLog
from src.utils.config import Config


class ForwardCurveCollector:
    """Collects specific contract month data to construct forward curves."""

    # CME month codes (quarterly contracts are most liquid)
    MONTH_CODES = {
        'H': ('March', 3),      # H = March
        'M': ('June', 6),       # M = June
        'U': ('September', 9),  # U = September
        'Z': ('December', 12),  # Z = December
    }

    def __init__(self):
        self.config = Config()
        self.db_manager = DatabaseManager()
        
        # Treasury futures base symbols
        self.futures_symbols = {
            'ZT': '2Y T-Note Futures',
            'ZF': '5Y T-Note Futures',
            'ZN': '10Y T-Note Futures',
            'ZB': '30Y T-Bond Futures',
            'UB': 'Ultra T-Bond Futures',
            'TN': 'Ultra 10Y T-Note Futures',
        }

    def generate_contract_codes(
        self, 
        base_symbol: str, 
        num_contracts: int = 8
    ) -> List[Tuple[str, str, date]]:
        """
        Generate contract codes for future months.
        
        Args:
            base_symbol: Base symbol (e.g., 'ZN' for 10Y T-Note)
            num_contracts: Number of future contracts to generate
            
        Returns:
            List of tuples: (contract_code, contract_month, expiration_date)
            e.g., [('ZNZ25', 'Z25', datetime(2025, 12, 19)), ...]
        """
        contracts = []
        current_date = datetime.now().date()
        
        # Generate quarterly contracts going forward
        for i in range(num_contracts):
            # Calculate which quarter we're in
            quarter_offset = i
            year = current_date.year
            month = current_date.month
            
            # Start from next quarter
            current_quarter_months = [3, 6, 9, 12]
            next_quarter_month = None
            for qm in current_quarter_months:
                if qm > month:
                    next_quarter_month = qm
                    break
            
            if next_quarter_month is None:
                next_quarter_month = 3
                year += 1
            
            # Calculate target month
            target_month = next_quarter_month + (quarter_offset * 3)
            target_year = year
            
            while target_month > 12:
                target_month -= 12
                target_year += 1
            
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
            
            # Estimate expiration date (3rd Friday of contract month, approximately)
            # Treasury futures typically expire on the business day prior to the last 7 days
            expiration_date = self._estimate_expiration_date(target_year, target_month)
            
            contracts.append((contract_code, contract_month, expiration_date))
        
        return contracts

    def _estimate_expiration_date(self, year: int, month: int) -> date:
        """
        Estimate futures contract expiration date.
        Treasury futures typically expire around the 20th of the contract month.
        This is an approximation - actual dates vary by contract and exchange rules.
        """
        # Use 20th as a reasonable approximation
        return date(year, month, 20)

    def collect_forward_curves(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        num_contracts: int = 8
    ) -> int:
        """
        Collect specific contract month data for forward curve construction.
        
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
            # Get data from 2 years ago to have enough history
            start_date = date.today() - timedelta(days=730)
        if end_date is None:
            end_date = date.today()
        
        logger.info(f"Collecting forward curve data from {start_date} to {end_date}")
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
                        contract_code,              # ZNH26
                        f"{contract_code}.CBT",     # ZNH26.CBT (CBOT)
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
            data_type='forward_curves',
            status='SUCCESS',
            records_collected=records_collected,
            start_time=datetime.utcnow() - timedelta(seconds=1),
            end_time=datetime.utcnow()
        )
        session.add(log_entry)
        session.commit()
        session.close()
        
        logger.info(f"Forward curve collection complete: {records_collected} new records")
        return records_collected

    def collect_all(self):
        """Entry point for scheduled collection."""
        # Collect last 2 years of data, tracking 8 contracts out
        start_date = date.today() - timedelta(days=730)
        return self.collect_forward_curves(start_date=start_date, num_contracts=8)


if __name__ == "__main__":
    collector = ForwardCurveCollector()
    
    # Test: generate contracts for ZN
    print("\n=== Testing Contract Code Generation ===")
    contracts = collector.generate_contract_codes('ZN', num_contracts=8)
    print(f"Generated {len(contracts)} contracts:")
    for code, month, exp_date in contracts:
        print(f"  {code} (month: {month}, expires: ~{exp_date})")
    
    print("\n=== Starting Forward Curve Collection ===")
    collector.collect_all()

