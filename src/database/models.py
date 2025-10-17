"""SQLAlchemy ORM models for database tables."""

from datetime import datetime, date
from typing import Optional
from decimal import Decimal

from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, BigInteger, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class TreasuryRate(Base):
    """Treasury yield curve rates."""
    __tablename__ = 'treasury_rates'
    
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    maturity = Column(String(10), nullable=False)
    rate = Column(Numeric(10, 6))
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<TreasuryRate(date={self.date}, maturity={self.maturity}, rate={self.rate})>"


class FedRate(Base):
    """Federal Reserve and policy rates."""
    __tablename__ = 'fed_rates'
    
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    rate_type = Column(String(50), nullable=False)
    rate = Column(Numeric(10, 6))
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<FedRate(date={self.date}, type={self.rate_type}, rate={self.rate})>"


class FuturesPrice(Base):
    """Interest rate futures prices."""
    __tablename__ = 'futures_prices'
    
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    contract_symbol = Column(String(20), nullable=False)
    contract_month = Column(String(10), nullable=False)
    expiration_date = Column(Date)
    settlement_price = Column(Numeric(12, 6))
    prior_settlement = Column(Numeric(12, 6))
    change = Column(Numeric(12, 6))
    high = Column(Numeric(12, 6))
    low = Column(Numeric(12, 6))
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<FuturesPrice(date={self.date}, symbol={self.contract_symbol}, month={self.contract_month}, price={self.settlement_price})>"


class FuturesVolume(Base):
    """Futures volume and open interest."""
    __tablename__ = 'futures_volume'
    
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    contract_symbol = Column(String(20), nullable=False)
    contract_month = Column(String(10), nullable=False)
    volume = Column(BigInteger)
    open_interest = Column(BigInteger)
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<FuturesVolume(date={self.date}, symbol={self.contract_symbol}, volume={self.volume})>"


class CFTCCOT(Base):
    """CFTC Commitments of Traders data."""
    __tablename__ = 'cftc_cot'
    
    id = Column(Integer, primary_key=True)
    report_date = Column(Date, nullable=False)
    contract_name = Column(String(100), nullable=False)
    cftc_contract_code = Column(String(20))
    
    open_interest_all = Column(BigInteger)
    
    noncomm_positions_long = Column(BigInteger)
    noncomm_positions_short = Column(BigInteger)
    noncomm_positions_spreading = Column(BigInteger)
    
    comm_positions_long = Column(BigInteger)
    comm_positions_short = Column(BigInteger)
    
    total_reportable_long = Column(BigInteger)
    total_reportable_short = Column(BigInteger)
    
    nonreportable_positions_long = Column(BigInteger)
    nonreportable_positions_short = Column(BigInteger)
    
    change_noncomm_long = Column(BigInteger)
    change_noncomm_short = Column(BigInteger)
    
    pct_noncomm_long = Column(Numeric(6, 2))
    pct_noncomm_short = Column(Numeric(6, 2))
    
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<CFTCCOT(date={self.report_date}, contract={self.contract_name})>"


class EconomicIndicator(Base):
    """Economic indicators."""
    __tablename__ = 'economic_indicators'
    
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    indicator_name = Column(String(100), nullable=False)
    indicator_code = Column(String(50), nullable=False)
    value = Column(Numeric(20, 6))
    unit = Column(String(50))
    source = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<EconomicIndicator(date={self.date}, indicator={self.indicator_name}, value={self.value})>"


class DataCollectionLog(Base):
    """Log of data collection runs."""
    __tablename__ = 'data_collection_log'
    
    id = Column(Integer, primary_key=True)
    collection_date = Column(DateTime, nullable=False)
    source = Column(String(50), nullable=False)
    data_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    records_collected = Column(Integer)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DataCollectionLog(date={self.collection_date}, source={self.source}, status={self.status})>"

