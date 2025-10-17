#!/usr/bin/env python3
"""Collect data from all sources."""

import sys
from pathlib import Path
import argparse
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from src.collectors import FREDCollector, TreasuryCollector, CFTCCollector
from src.utils.config import get_config


def collect_all_data(incremental=False, backfill_years=None):
    """Collect data from all sources.
    
    Args:
        incremental: If True, only collect recent data (last 30 days).
        backfill_years: Number of years to backfill. Ignored if incremental=True.
    """
    config = get_config()
    
    if backfill_years is None:
        backfill_years = config.get('collection.backfill_years', 10)
    
    logger.info("="*60)
    logger.info("Starting data collection")
    logger.info(f"Mode: {'Incremental' if incremental else f'Full backfill ({backfill_years} years)'}")
    logger.info(f"Start time: {datetime.now()}")
    logger.info("="*60)
    
    total_records = 0
    
    # Override backfill for incremental mode
    if incremental:
        backfill_years = 0.1  # ~36 days
        logger.info("Incremental mode: collecting last 30 days only")
    
    # FRED Collection
    logger.info("\n[1/3] Collecting from FRED...")
    try:
        fred_collector = FREDCollector()
        fred_results = fred_collector.collect_all(backfill_years=backfill_years)
        logger.success(f"FRED collection complete: {sum(fred_results.values())} records")
        for data_type, count in fred_results.items():
            logger.info(f"  - {data_type}: {count} records")
        total_records += sum(fred_results.values())
    except Exception as e:
        logger.error(f"FRED collection failed: {e}")
        if not incremental:
            logger.warning("Continuing with other sources...")
    
    # Treasury Collection
    logger.info("\n[2/3] Collecting from US Treasury...")
    try:
        treasury_collector = TreasuryCollector()
        treasury_results = treasury_collector.collect_all(backfill_years=backfill_years)
        logger.success(f"Treasury collection complete: {sum(treasury_results.values())} records")
        for data_type, count in treasury_results.items():
            logger.info(f"  - {data_type}: {count} records")
        total_records += sum(treasury_results.values())
    except Exception as e:
        logger.error(f"Treasury collection failed: {e}")
        if not incremental:
            logger.warning("Continuing with other sources...")
    
    # CFTC Collection
    logger.info("\n[3/3] Collecting from CFTC...")
    try:
        cftc_collector = CFTCCollector()
        cftc_results = cftc_collector.collect_all(backfill_years=backfill_years)
        logger.success(f"CFTC collection complete: {sum(cftc_results.values())} records")
        for data_type, count in cftc_results.items():
            logger.info(f"  - {data_type}: {count} records")
        total_records += sum(cftc_results.values())
    except Exception as e:
        logger.error(f"CFTC collection failed: {e}")
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("Data collection complete!")
    logger.info(f"Total records collected: {total_records}")
    logger.info(f"End time: {datetime.now()}")
    logger.info("="*60)
    
    if total_records > 0:
        logger.info("\nNext steps:")
        logger.info("  - View data: streamlit run src/visualization/app.py")
        logger.info("  - Query database: psql -U postgres interest_rates_db")
    else:
        logger.warning("\nNo records collected! Check:")
        logger.warning("  - FRED API key in config.yaml")
        logger.warning("  - Internet connection")
        logger.warning("  - Database connection")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Collect interest rates data from all sources"
    )
    parser.add_argument(
        '--incremental',
        action='store_true',
        help='Only collect recent data (last 30 days)'
    )
    parser.add_argument(
        '--backfill-years',
        type=int,
        help='Number of years to backfill (default: from config.yaml)'
    )
    
    args = parser.parse_args()
    
    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level="INFO"
    )
    
    # Also log to file
    log_file = Path(__file__).parent.parent / "logs" / f"collection_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    log_file.parent.mkdir(exist_ok=True)
    logger.add(
        str(log_file),
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
        level="DEBUG"
    )
    
    collect_all_data(
        incremental=args.incremental,
        backfill_years=args.backfill_years
    )


if __name__ == '__main__':
    main()

