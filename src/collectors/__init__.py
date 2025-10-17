"""Data collectors package."""

from src.collectors.fred_collector import FREDCollector
from src.collectors.treasury_collector import TreasuryCollector
from src.collectors.cftc_collector import CFTCCollector
from src.collectors.cme_collector import CMECollector

__all__ = [
    'FREDCollector',
    'TreasuryCollector',
    'CFTCCollector',
    'CMECollector',
]

