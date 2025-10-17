#!/usr/bin/env python3
"""Validate the setup and configuration."""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
import yaml


def check_config():
    """Check if configuration is valid."""
    logger.info("Checking configuration...")
    
    config_path = Path(__file__).parent.parent / "config.yaml"
    
    if not config_path.exists():
        logger.error("✗ config.yaml not found")
        return False
    
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        # Check FRED API key
        fred_key = config.get('apis', {}).get('fred', {}).get('api_key', '')
        if not fred_key or fred_key == 'YOUR_FRED_API_KEY_HERE':
            logger.warning("✗ FRED API key not configured in config.yaml")
            logger.info("  Get a free key from: https://fred.stlouisfed.org/docs/api/api_key.html")
            return False
        else:
            logger.success(f"✓ FRED API key configured (length: {len(fred_key)})")
        
        # Check database config
        db_config = config.get('database', {})
        if not all(k in db_config for k in ['host', 'port', 'name', 'user']):
            logger.error("✗ Incomplete database configuration")
            return False
        else:
            logger.success(f"✓ Database configuration found ({db_config['name']})")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Failed to load config: {e}")
        return False


def check_database():
    """Check if database is accessible."""
    logger.info("\nChecking database connection...")
    
    try:
        from src.database.connection import get_db_manager
        
        db_manager = get_db_manager()
        
        if db_manager.test_connection():
            logger.success("✓ Database connection successful")
            
            # Check if tables exist
            with db_manager.engine.connect() as conn:
                from sqlalchemy import text
                result = conn.execute(text("""
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
                table_count = result.scalar()
                
                if table_count > 0:
                    logger.success(f"✓ Database schema initialized ({table_count} tables)")
                    return True
                else:
                    logger.warning("✗ Database schema not initialized")
                    logger.info("  Run: python scripts/init_database.py")
                    return False
        else:
            logger.error("✗ Database connection failed")
            return False
            
    except Exception as e:
        logger.error(f"✗ Database error: {e}")
        return False


def check_data():
    """Check if data exists."""
    logger.info("\nChecking data availability...")
    
    try:
        from src.database.connection import get_db_manager
        from sqlalchemy import text
        
        db_manager = get_db_manager()
        
        with db_manager.engine.connect() as conn:
            # Check treasury rates
            result = conn.execute(text("SELECT COUNT(*) FROM treasury_rates"))
            treasury_count = result.scalar()
            
            # Check fed rates
            result = conn.execute(text("SELECT COUNT(*) FROM fed_rates"))
            fed_count = result.scalar()
            
            # Check CFTC data
            result = conn.execute(text("SELECT COUNT(*) FROM cftc_cot"))
            cftc_count = result.scalar()
            
            total = treasury_count + fed_count + cftc_count
            
            if total > 0:
                logger.success(f"✓ Data collected ({total:,} total records)")
                logger.info(f"  - Treasury rates: {treasury_count:,}")
                logger.info(f"  - Fed rates: {fed_count:,}")
                logger.info(f"  - CFTC COT: {cftc_count:,}")
                return True
            else:
                logger.warning("✗ No data collected yet")
                logger.info("  Run: python scripts/collect_all.py")
                return False
                
    except Exception as e:
        logger.error(f"✗ Failed to check data: {e}")
        return False


def check_dependencies():
    """Check if required packages are installed."""
    logger.info("\nChecking dependencies...")
    
    required = [
        'pandas',
        'numpy',
        'sqlalchemy',
        'psycopg2',
        'requests',
        'fredapi',
        'streamlit',
        'plotly',
        'pyyaml',
        'loguru'
    ]
    
    missing = []
    for package in required:
        try:
            __import__(package)
            logger.success(f"✓ {package}")
        except ImportError:
            logger.error(f"✗ {package}")
            missing.append(package)
    
    if missing:
        logger.error(f"\nMissing packages: {', '.join(missing)}")
        logger.info("Run: pip install -r requirements.txt")
        return False
    
    return True


def main():
    """Main validation function."""
    logger.remove()
    logger.add(
        sys.stderr,
        format="<level>{message}</level>",
        level="INFO"
    )
    
    logger.info("="*60)
    logger.info("Interest Rates Data Infrastructure - Setup Validation")
    logger.info("="*60)
    
    checks = {
        'Dependencies': check_dependencies(),
        'Configuration': check_config(),
        'Database': check_database(),
        'Data': check_data()
    }
    
    logger.info("\n" + "="*60)
    logger.info("Validation Summary")
    logger.info("="*60)
    
    for check_name, passed in checks.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{check_name}: {status}")
    
    all_passed = all(checks.values())
    
    if all_passed:
        logger.info("\n" + "="*60)
        logger.success("All checks passed! ✓")
        logger.info("="*60)
        logger.info("\nYou're ready to go!")
        logger.info("Launch dashboard: streamlit run src/visualization/app.py")
        return 0
    else:
        logger.info("\n" + "="*60)
        logger.warning("Some checks failed ✗")
        logger.info("="*60)
        logger.info("\nSee SETUP.md for detailed setup instructions")
        return 1


if __name__ == '__main__':
    sys.exit(main())

