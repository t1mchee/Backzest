"""
TradingView Collector for Backzest
Interfaces with the Node.js TradingView service to get real-time data
"""

import requests
from typing import Optional, List, Dict
from datetime import datetime, date
from loguru import logger

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))

from src.utils.config import Config


class TradingViewCollector:
    """
    Python interface to the TradingView Node.js service.
    Provides methods to subscribe, fetch data, and manage subscriptions.
    """
    
    def __init__(self, service_url: str = 'http://localhost:3001'):
        """
        Initialize the TradingView collector.
        
        Args:
            service_url: URL of the TradingView Node.js service
        """
        self.service_url = service_url.rstrip('/')
        self.config = Config()
        
        # Test connection
        try:
            response = requests.get(f"{self.service_url}/health", timeout=5)
            if response.status_code == 200:
                logger.info(f"✅ Connected to TradingView service at {service_url}")
            else:
                logger.warning(f"⚠️  TradingView service responded with status {response.status_code}")
        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Could not connect to TradingView service: {e}")
            logger.info(f"Make sure the service is running: cd services/tradingview && npm start")
    
    def subscribe(
        self,
        symbol: str,
        timeframe: str = '5',
        indicators: Optional[List[str]] = None
    ) -> Dict:
        """
        Subscribe to a symbol for real-time data collection.
        
        Args:
            symbol: TradingView symbol (e.g., 'CBOT:ZN1!')
            timeframe: Timeframe ('1', '5', '15', '60', 'D')
            indicators: List of indicator names (e.g., ['RSI', 'MACD'])
            
        Returns:
            Subscription info dict
        """
        endpoint = f"{self.service_url}/subscribe"
        payload = {
            'symbol': symbol,
            'timeframe': timeframe,
            'indicators': indicators or []
        }
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"✅ Subscribed to {symbol} ({timeframe} min)")
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Error subscribing to {symbol}: {e}")
            raise
    
    def unsubscribe(self, subscription_id: str) -> bool:
        """
        Unsubscribe from a symbol.
        
        Args:
            subscription_id: Subscription ID (format: 'SYMBOL_TIMEFRAME')
            
        Returns:
            True if successful
        """
        endpoint = f"{self.service_url}/unsubscribe"
        payload = {'subscriptionId': subscription_id}
        
        try:
            response = requests.post(endpoint, json=payload, timeout=5)
            response.raise_for_status()
            
            logger.info(f"✅ Unsubscribed from {subscription_id}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error unsubscribing from {subscription_id}: {e}")
            return False
    
    def get_subscriptions(self) -> List[Dict]:
        """
        Get list of all active subscriptions.
        
        Returns:
            List of subscription dicts
        """
        endpoint = f"{self.service_url}/subscriptions"
        
        try:
            response = requests.get(endpoint, timeout=5)
            response.raise_for_status()
            data = response.json()
            
            return data.get('subscriptions', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting subscriptions: {e}")
            return []
    
    def get_latest_price(self, subscription_id: str) -> Optional[Dict]:
        """
        Get the latest price for a subscription.
        
        Args:
            subscription_id: Subscription ID
            
        Returns:
            Price data dict or None
        """
        endpoint = f"{self.service_url}/price/{subscription_id}"
        
        try:
            response = requests.get(endpoint, timeout=5)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting price for {subscription_id}: {e}")
            return None
    
    def get_historical_prices(
        self,
        symbol: str,
        timeframe: str = '5',
        limit: int = 100
    ) -> List[Dict]:
        """
        Get historical prices from database.
        
        Args:
            symbol: Symbol (e.g., 'CBOT:ZN1!')
            timeframe: Timeframe
            limit: Number of bars to return
            
        Returns:
            List of price dicts
        """
        endpoint = f"{self.service_url}/historical/{symbol}"
        params = {
            'timeframe': timeframe,
            'limit': limit
        }
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return data.get('data', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting historical data for {symbol}: {e}")
            return []
    
    def get_indicator_history(
        self,
        symbol: str,
        indicator: str,
        limit: int = 100
    ) -> List[Dict]:
        """
        Get indicator history from database.
        
        Args:
            symbol: Symbol
            indicator: Indicator name (e.g., 'RSI')
            limit: Number of values to return
            
        Returns:
            List of indicator value dicts
        """
        endpoint = f"{self.service_url}/indicators/{symbol}/{indicator}"
        params = {'limit': limit}
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return data.get('data', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error getting indicator data: {e}")
            return []
    
    def search_symbols(self, query: str) -> List[Dict]:
        """
        Search for symbols on TradingView.
        
        Args:
            query: Search query (e.g., 'CBOT' or 'T-Note')
            
        Returns:
            List of symbol dicts
        """
        endpoint = f"{self.service_url}/search"
        params = {'query': query}
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return data.get('results', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"Error searching symbols: {e}")
            return []
    
    def add_indicators(
        self,
        subscription_id: str,
        indicators: List[str]
    ) -> bool:
        """
        Add indicators to an existing subscription.
        
        Args:
            subscription_id: Subscription ID
            indicators: List of indicator names
            
        Returns:
            True if successful
        """
        endpoint = f"{self.service_url}/indicators/add"
        payload = {
            'subscriptionId': subscription_id,
            'indicators': indicators
        }
        
        try:
            response = requests.post(endpoint, json=payload, timeout=10)
            response.raise_for_status()
            
            logger.info(f"✅ Added indicators to {subscription_id}: {indicators}")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error adding indicators: {e}")
            return False


def main():
    """Example usage"""
    collector = TradingViewCollector()
    
    # Search for Treasury futures
    print("\n🔍 Searching for Treasury futures...")
    results = collector.search_symbols('CBOT')
    for result in results[:5]:
        print(f"  {result['symbol']}: {result['description']}")
    
    # Subscribe to 10Y T-Note futures
    print("\n📊 Subscribing to 10Y T-Note futures...")
    subscription = collector.subscribe('CBOT:ZN1!', timeframe='5', indicators=['RSI'])
    subscription_id = subscription['subscriptionId']
    print(f"  Subscription ID: {subscription_id}")
    
    # Wait a few seconds for data
    import time
    print("\n⏳ Waiting for data...")
    time.sleep(5)
    
    # Get latest price
    print("\n💰 Getting latest price...")
    price = collector.get_latest_price(subscription_id)
    if price:
        print(f"  Price: {price['close']}")
        print(f"  High: {price['high']}")
        print(f"  Low: {price['low']}")
        print(f"  Volume: {price['volume']}")
    
    # Get historical data
    print("\n📈 Getting historical data...")
    historical = collector.get_historical_prices('CBOT:ZN1!', limit=10)
    print(f"  Retrieved {len(historical)} bars")
    
    # List all subscriptions
    print("\n📋 Active subscriptions:")
    subscriptions = collector.get_subscriptions()
    for sub in subscriptions:
        print(f"  {sub['id']}: {sub['description']}")


if __name__ == '__main__':
    main()

