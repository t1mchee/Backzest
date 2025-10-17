#!/usr/bin/env python3
"""Initialize the database schema."""

import sys
from pathlib import Path
import argparse

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from loguru import logger
from src.database.connection import get_db_manager
from src.utils.config import get_config


def init_database(test_only=False):
    """Initialize the database.
    
    Args:
        test_only: If True, only test connection without initializing schema.
    """
    logger.info("Initializing database...")
    
    try:
        # Get database manager
        db_manager = get_db_manager()
        
        # Test connection
        logger.info("Testing database connection...")
        if not db_manager.test_connection():
            logger.error("Database connection failed!")
            return False
        
        if test_only:
            logger.info("Connection test successful!")
            return True
        
        # Initialize schema
        logger.info("Creating database schema...")
        if db_manager.initialize_schema():
            logger.success("Database schema initialized successfully!")
            
            # Verify tables were created
            logger.info("Verifying tables...")
            with db_manager.engine.connect() as conn:
                from sqlalchemy import text
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """))
                tables = [row[0] for row in result]
                
                logger.info(f"Created {len(tables)} tables:")
                for table in tables:
                    logger.info(f"  ✓ {table}")
            
            return True
        else:
            logger.error("Failed to initialize schema!")
            return False
            
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Initialize interest rates database")
    parser.add_argument(
        '--test',
        action='store_true',
        help='Only test database connection without initializing schema'
    )
    
    args = parser.parse_args()
    
    # Configure logging
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level="INFO"
    )
    
    success = init_database(test_only=args.test)
    
    if success:
        if not args.test:
            logger.info("\n" + "="*60)
            logger.info("Database is ready!")
            logger.info("Next steps:")
            logger.info("  1. Update config.yaml with your FRED API key")
            logger.info("  2. Run: python scripts/collect_all.py")
            logger.info("  3. Launch dashboard: streamlit run src/visualization/app.py")
            logger.info("="*60)
        sys.exit(0)
    else:
        logger.error("\n" + "="*60)
        logger.error("Database initialization failed!")
        logger.error("Check:")
        logger.error("  1. PostgreSQL is running: pg_isready")
        logger.error("  2. Database exists: psql -U postgres -l")
        logger.error("  3. Credentials in config.yaml are correct")
        logger.error("="*60)
        sys.exit(1)


if __name__ == '__main__':
    main()

