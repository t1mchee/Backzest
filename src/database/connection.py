"""Database connection management."""

import os
from typing import Optional
from pathlib import Path
import yaml
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
from loguru import logger


class DatabaseManager:
    """Manages database connections and operations."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize database manager.
        
        Args:
            config_path: Path to config.yaml file. If None, looks in project root.
        """
        if config_path is None:
            # Look for config in project root
            config_path = Path(__file__).parent.parent.parent / "config.yaml"
        
        with open(config_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        self.db_config = self.config['database']
        self.engine = None
        self.SessionLocal = None
        self._initialize_engine()
    
    def _initialize_engine(self):
        """Initialize SQLAlchemy engine."""
        connection_string = (
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}"
            f"@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['name']}"
        )
        
        try:
            self.engine = create_engine(
                connection_string,
                poolclass=NullPool,  # Disable connection pooling for simplicity
                echo=False
            )
            self.SessionLocal = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self.engine
            )
            logger.info(f"Database engine initialized for {self.db_config['name']}")
        except Exception as e:
            logger.error(f"Failed to initialize database engine: {e}")
            raise
    
    def get_session(self) -> Session:
        """Get a new database session.
        
        Returns:
            SQLAlchemy session object.
        """
        if self.SessionLocal is None:
            raise RuntimeError("Database engine not initialized")
        return self.SessionLocal()
    
    def test_connection(self) -> bool:
        """Test database connection.
        
        Returns:
            True if connection successful, False otherwise.
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                logger.info("Database connection successful")
                return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
    
    def initialize_schema(self):
        """Initialize database schema from schema.sql file."""
        schema_path = Path(__file__).parent / "schema.sql"
        
        if not schema_path.exists():
            logger.error(f"Schema file not found at {schema_path}")
            return False
        
        try:
            with open(schema_path, 'r') as f:
                schema_sql = f.read()
            
            with self.engine.connect() as conn:
                # Execute schema SQL
                for statement in schema_sql.split(';'):
                    statement = statement.strip()
                    if statement:
                        conn.execute(text(statement))
                conn.commit()
            
            logger.info("Database schema initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize schema: {e}")
            return False
    
    def execute_query(self, query: str, params: Optional[dict] = None):
        """Execute a raw SQL query.
        
        Args:
            query: SQL query string.
            params: Optional query parameters.
            
        Returns:
            Query result.
        """
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(query), params or {})
                conn.commit()
                return result
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def close(self):
        """Close database connections."""
        if self.engine:
            self.engine.dispose()
            logger.info("Database connections closed")


# Global database manager instance
_db_manager: Optional[DatabaseManager] = None


def get_db_manager(config_path: Optional[str] = None) -> DatabaseManager:
    """Get or create global database manager instance.
    
    Args:
        config_path: Path to config file.
        
    Returns:
        DatabaseManager instance.
    """
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager(config_path)
    return _db_manager


def get_session() -> Session:
    """Get a database session (convenience function).
    
    Returns:
        SQLAlchemy session.
    """
    return get_db_manager().get_session()

