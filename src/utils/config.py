"""Configuration utilities."""

import os
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from loguru import logger


class Config:
    """Configuration manager for the application."""
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration.
        
        Args:
            config_path: Path to config.yaml. If None, looks in project root.
        """
        if config_path is None:
            # Look for config in project root
            project_root = Path(__file__).parent.parent.parent
            config_path = project_root / "config.yaml"
        
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        self.load()
    
    def load(self):
        """Load configuration from file."""
        if not self.config_path.exists():
            logger.warning(f"Config file not found at {self.config_path}")
            return
        
        try:
            with open(self.config_path, 'r') as f:
                self.config = yaml.safe_load(f)
            logger.info(f"Configuration loaded from {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            raise
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key.
        
        Args:
            key: Configuration key (supports dot notation, e.g., 'database.host')
            default: Default value if key not found.
            
        Returns:
            Configuration value or default.
        """
        keys = key.split('.')
        value = self.config
        
        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default
        
        return value
    
    def set(self, key: str, value: Any):
        """Set configuration value.
        
        Args:
            key: Configuration key (supports dot notation)
            value: Value to set
        """
        keys = key.split('.')
        config = self.config
        
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        
        config[keys[-1]] = value
    
    def save(self):
        """Save configuration to file."""
        try:
            with open(self.config_path, 'w') as f:
                yaml.dump(self.config, f, default_flow_style=False)
            logger.info(f"Configuration saved to {self.config_path}")
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            raise
    
    @property
    def database(self) -> Dict[str, Any]:
        """Get database configuration."""
        return self.get('database', {})
    
    @property
    def apis(self) -> Dict[str, Any]:
        """Get API configuration."""
        return self.get('apis', {})
    
    @property
    def fred_series(self) -> Dict[str, Any]:
        """Get FRED series configuration."""
        return self.get('fred_series', {})
    
    @property
    def collection(self) -> Dict[str, Any]:
        """Get collection settings."""
        return self.get('collection', {})


# Global config instance
_config: Optional[Config] = None


def get_config(config_path: Optional[str] = None) -> Config:
    """Get or create global config instance.
    
    Args:
        config_path: Path to config file.
        
    Returns:
        Config instance.
    """
    global _config
    if _config is None:
        _config = Config(config_path)
    return _config

