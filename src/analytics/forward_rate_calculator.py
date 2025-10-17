"""
Forward Rate Calculator - Calculate implied forward rates from futures prices and spot rates.
"""

import pandas as pd
import numpy as np
from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from loguru import logger


class ForwardRateCalculator:
    """Calculate implied forward rates from SOFR futures and spot rates."""
    
    @staticmethod
    def futures_price_to_rate(futures_price: float) -> float:
        """
        Convert SOFR futures price to implied rate.
        SOFR futures are quoted as 100 minus the implied rate.
        
        Args:
            futures_price: Futures price (e.g., 95.50)
            
        Returns:
            Implied rate as percentage (e.g., 4.50)
        """
        return 100.0 - futures_price
    
    @staticmethod
    def calculate_forward_rate(
        r1: float, 
        t1: float, 
        r2: float, 
        t2: float
    ) -> float:
        """
        Calculate forward rate between two periods using spot rates.
        
        Formula: forward_rate = [(1 + r2)^t2 / (1 + r1)^t1]^(1/(t2-t1)) - 1
        
        Args:
            r1: Spot rate for period 1 (as decimal, e.g., 0.04 for 4%)
            t1: Time to period 1 in years
            r2: Spot rate for period 2 (as decimal)
            t2: Time to period 2 in years
            
        Returns:
            Forward rate as decimal (e.g., 0.045 for 4.5%)
        """
        if t2 <= t1:
            raise ValueError("t2 must be greater than t1")
        
        # Convert to decimal if given as percentage
        if r1 > 1:
            r1 = r1 / 100
        if r2 > 1:
            r2 = r2 / 100
        
        forward_rate = ((1 + r2) ** t2 / (1 + r1) ** t1) ** (1 / (t2 - t1)) - 1
        return forward_rate
    
    @staticmethod
    def calculate_forward_from_futures(
        futures_data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Calculate implied forward rates from SOFR futures strip.
        
        Args:
            futures_data: DataFrame with columns:
                - date: Trade date
                - contract_month: Contract identifier
                - settlement_price: Futures price
                - expiration_date: Contract expiration date
                
        Returns:
            DataFrame with forward rates calculated from futures
        """
        if futures_data.empty:
            return pd.DataFrame()
        
        # Convert futures prices to implied rates
        futures_data = futures_data.copy()
        futures_data['implied_rate'] = futures_data['settlement_price'].apply(
            ForwardRateCalculator.futures_price_to_rate
        )
        
        # Calculate days to expiration
        futures_data['days_to_expiry'] = (
            pd.to_datetime(futures_data['expiration_date']) - 
            pd.to_datetime(futures_data['date'])
        ).dt.days
        
        # Convert to years
        futures_data['years_to_expiry'] = futures_data['days_to_expiry'] / 365.25
        
        return futures_data
    
    @staticmethod
    def bootstrap_sofr_curve(
        futures_strip: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Bootstrap a SOFR forward curve from a strip of futures contracts.
        
        Args:
            futures_strip: DataFrame with futures data for a single date,
                sorted by expiration date
                
        Returns:
            DataFrame with bootstrapped forward curve
        """
        if futures_strip.empty:
            return pd.DataFrame()
        
        # Sort by expiration date
        futures_strip = futures_strip.sort_values('expiration_date').copy()
        
        # Calculate implied rates
        futures_strip['implied_rate'] = futures_strip['settlement_price'].apply(
            ForwardRateCalculator.futures_price_to_rate
        ) / 100  # Convert to decimal
        
        # Calculate time to expiration in years
        base_date = futures_strip['date'].iloc[0]
        futures_strip['years_to_expiry'] = (
            pd.to_datetime(futures_strip['expiration_date']) - 
            pd.to_datetime(base_date)
        ).dt.days / 365.25
        
        # For SOFR futures, the implied rate is approximately the forward rate
        # for the period covered by the contract
        futures_strip['forward_rate'] = futures_strip['implied_rate']
        
        return futures_strip[['contract_month', 'expiration_date', 
                              'years_to_expiry', 'implied_rate', 'forward_rate']]
    
    @staticmethod
    def get_forward_rate(
        spot_rates: pd.DataFrame,
        start_months: int,
        end_months: int,
        as_of_date: Optional[date] = None
    ) -> Optional[float]:
        """
        Calculate forward rate for a specific tenor from spot rates.
        
        Args:
            spot_rates: DataFrame with spot rates (columns: date, maturity, rate)
            start_months: Start period in months (e.g., 3 for 3 months)
            end_months: End period in months (e.g., 6 for 6 months)
            as_of_date: Reference date (defaults to most recent)
            
        Returns:
            Forward rate as percentage, or None if data not available
        """
        if spot_rates.empty:
            return None
        
        # Filter to specific date if provided
        if as_of_date:
            spot_rates = spot_rates[spot_rates['date'] == as_of_date]
        else:
            # Use most recent date
            as_of_date = spot_rates['date'].max()
            spot_rates = spot_rates[spot_rates['date'] == as_of_date]
        
        if spot_rates.empty:
            return None
        
        # Convert months to maturity strings
        maturity_map = {
            1: '1M', 3: '3M', 6: '6M', 12: '1Y',
            24: '2Y', 36: '3Y', 60: '5Y', 84: '7Y',
            120: '10Y', 240: '20Y', 360: '30Y'
        }
        
        start_maturity = maturity_map.get(start_months)
        end_maturity = maturity_map.get(end_months)
        
        if not start_maturity or not end_maturity:
            logger.warning(f"Unsupported tenor: {start_months}m -> {end_months}m")
            return None
        
        # Get spot rates
        r1_row = spot_rates[spot_rates['maturity'] == start_maturity]
        r2_row = spot_rates[spot_rates['maturity'] == end_maturity]
        
        if r1_row.empty or r2_row.empty:
            logger.warning(f"Missing spot rates for {start_maturity} or {end_maturity}")
            return None
        
        r1 = r1_row['rate'].iloc[0] / 100  # Convert to decimal
        r2 = r2_row['rate'].iloc[0] / 100
        
        t1 = start_months / 12  # Convert to years
        t2 = end_months / 12
        
        try:
            forward_rate = ForwardRateCalculator.calculate_forward_rate(r1, t1, r2, t2)
            return forward_rate * 100  # Convert back to percentage
        except Exception as e:
            logger.error(f"Error calculating forward rate: {e}")
            return None
    
    @staticmethod
    def calculate_forward_rate_series(
        spot_rates: pd.DataFrame,
        start_months: int,
        end_months: int
    ) -> pd.DataFrame:
        """
        Calculate a time series of forward rates.
        
        Args:
            spot_rates: DataFrame with historical spot rates
            start_months: Start period in months
            end_months: End period in months
            
        Returns:
            DataFrame with date and forward_rate columns
        """
        if spot_rates.empty:
            return pd.DataFrame()
        
        # Get unique dates
        dates = sorted(spot_rates['date'].unique())
        
        results = []
        for dt in dates:
            forward_rate = ForwardRateCalculator.get_forward_rate(
                spot_rates, start_months, end_months, dt
            )
            if forward_rate is not None:
                results.append({
                    'date': dt,
                    'forward_rate': forward_rate,
                    'tenor': f"{start_months}m{end_months}m"
                })
        
        return pd.DataFrame(results)


if __name__ == "__main__":
    # Test forward rate calculation
    print("\n=== Testing Forward Rate Calculator ===\n")
    
    # Test 1: Simple forward rate calculation
    print("Test 1: Calculate 1y1y forward rate")
    print("Given: 1Y spot = 4.0%, 2Y spot = 4.5%")
    forward = ForwardRateCalculator.calculate_forward_rate(
        r1=0.04, t1=1, r2=0.045, t2=2
    )
    print(f"1y1y forward rate: {forward*100:.2f}%\n")
    
    # Test 2: Futures price to rate
    print("Test 2: Convert futures price to implied rate")
    price = 95.50
    rate = ForwardRateCalculator.futures_price_to_rate(price)
    print(f"Futures price {price} => Implied rate {rate}%\n")
    
    print("Forward Rate Calculator tests complete!")

