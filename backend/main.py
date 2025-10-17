"""
FastAPI Backend for US Interest Rates Analysis Platform
Provides REST API endpoints for all data sources
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import date, datetime, timedelta
from pydantic import BaseModel
import pandas as pd
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from src.database.connection import DatabaseManager
from src.utils.config import Config

# Initialize FastAPI app
app = FastAPI(
    title="US Interest Rates API",
    description="REST API for US interest rates, Treasury data, and futures positioning",
    version="1.0.0"
)

# Configure CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database connection
config = Config()
db_manager = DatabaseManager()


# Pydantic models for responses
class TreasuryRate(BaseModel):
    date: date
    maturity: str
    rate: float
    source: str

class FedRate(BaseModel):
    date: date
    rate_type: str
    rate: float
    source: str

class COTData(BaseModel):
    report_date: date
    contract_name: str
    open_interest: Optional[int]
    noncomm_long: Optional[int]
    noncomm_short: Optional[int]
    comm_long: Optional[int]
    comm_short: Optional[int]

class YieldCurvePoint(BaseModel):
    maturity: str
    rate: float
    maturity_years: float


# Health check endpoint
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "api": "US Interest Rates API",
        "version": "1.0.0"
    }


# Treasury Rates Endpoints
@app.get("/api/treasury/rates")
async def get_treasury_rates(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    maturity: Optional[str] = None
):
    """Get Treasury rates with optional filters"""
    try:
        query = """
            SELECT date, maturity, rate, source
            FROM treasury_rates
            WHERE 1=1
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date
        if maturity:
            query += " AND maturity = %(maturity)s"
            params['maturity'] = maturity

        query += " ORDER BY date DESC, maturity"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/treasury/yield-curve")
async def get_yield_curve(
    curve_date: Optional[date] = None
):
    """Get yield curve for a specific date"""
    try:
        if not curve_date:
            curve_date = date.today()

        query = """
            SELECT maturity, rate, source
            FROM treasury_rates
            WHERE date = %(date)s
            ORDER BY 
                CASE maturity
                    WHEN '1M' THEN 1
                    WHEN '3M' THEN 2
                    WHEN '6M' THEN 3
                    WHEN '1Y' THEN 4
                    WHEN '2Y' THEN 5
                    WHEN '3Y' THEN 6
                    WHEN '5Y' THEN 7
                    WHEN '7Y' THEN 8
                    WHEN '10Y' THEN 9
                    WHEN '20Y' THEN 10
                    WHEN '30Y' THEN 11
                END
        """

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'date': curve_date})

        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for date {curve_date}")

        # Add maturity in years for plotting
        maturity_map = {
            '1M': 1/12, '3M': 3/12, '6M': 6/12, '1Y': 1,
            '2Y': 2, '3Y': 3, '5Y': 5, '7Y': 7, '10Y': 10,
            '20Y': 20, '30Y': 30
        }
        df['maturity_years'] = df['maturity'].map(maturity_map)

        return {
            "date": curve_date,
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/treasury/spreads")
async def get_treasury_spreads(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get Treasury spreads (10Y-2Y, 10Y-3M)"""
    try:
        # Default to last 2 years
        if not start_date:
            start_date = date.today() - timedelta(days=730)
        if not end_date:
            end_date = date.today()

        query = """
            WITH spreads AS (
                SELECT 
                    date,
                    MAX(CASE WHEN maturity = '10Y' THEN rate END) as rate_10y,
                    MAX(CASE WHEN maturity = '2Y' THEN rate END) as rate_2y,
                    MAX(CASE WHEN maturity = '3M' THEN rate END) as rate_3m
                FROM treasury_rates
                WHERE date >= %(start_date)s AND date <= %(end_date)s
                GROUP BY date
            )
            SELECT 
                date,
                rate_10y,
                rate_2y,
                rate_3m,
                (rate_10y - rate_2y) as spread_10y2y,
                (rate_10y - rate_3m) as spread_10y3m
            FROM spreads
            WHERE rate_10y IS NOT NULL
            ORDER BY date DESC
        """

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'start_date': start_date, 'end_date': end_date})

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Fed Rates Endpoints
@app.get("/api/fed/rates")
async def get_fed_rates(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    rate_type: Optional[str] = None
):
    """Get Federal Reserve rates (Fed Funds, SOFR, etc.)"""
    try:
        query = """
            SELECT date, rate_type, rate, source
            FROM fed_rates
            WHERE 1=1
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date
        if rate_type:
            query += " AND rate_type = %(rate_type)s"
            params['rate_type'] = rate_type

        query += " ORDER BY date DESC, rate_type"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# CFTC COT Endpoints
@app.get("/api/cftc/cot")
async def get_cot_data(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    contract_name: Optional[str] = None
):
    """Get CFTC Commitments of Traders data for interest rate futures"""
    try:
        query = """
            SELECT 
                report_date,
                contract_name,
                open_interest_all,
                noncomm_positions_long,
                noncomm_positions_short,
                comm_positions_long,
                comm_positions_short,
                pct_noncomm_long,
                pct_noncomm_short
            FROM cftc_cot
            WHERE 1=1
        """
        params = {}

        if start_date:
            query += " AND report_date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND report_date <= %(end_date)s"
            params['end_date'] = end_date
        if contract_name:
            query += " AND contract_name = %(contract_name)s"
            params['contract_name'] = contract_name

        query += " ORDER BY report_date DESC, contract_name"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/cftc/contracts")
async def get_cot_contracts():
    """Get list of available COT contracts"""
    try:
        query = """
            SELECT DISTINCT contract_name, COUNT(*) as record_count
            FROM cftc_cot
            GROUP BY contract_name
            ORDER BY contract_name
        """

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn)

        return {
            "contracts": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Futures Prices Endpoints
@app.get("/api/futures/prices")
async def get_futures_prices(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    symbol: Optional[str] = None
):
    """Get futures price data"""
    try:
        query = """
            SELECT 
                date,
                contract_symbol as symbol,
                settlement_price as close,
                prior_settlement as open,
                high,
                low,
                change
            FROM futures_prices
            WHERE contract_month = 'CONTINUOUS' AND source = 'YAHOO_FINANCE'
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date
        if symbol:
            query += " AND contract_symbol = %(symbol)s"
            params['symbol'] = symbol

        query += " ORDER BY date DESC, contract_symbol"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/futures/symbols")
async def get_futures_symbols():
    """Get list of available futures symbols"""
    try:
        query = """
            SELECT DISTINCT 
                contract_symbol as symbol,
                COUNT(*) as record_count,
                MIN(date) as earliest_date,
                MAX(date) as latest_date
            FROM futures_prices
            WHERE contract_month = 'CONTINUOUS' AND source = 'YAHOO_FINANCE'
            GROUP BY contract_symbol
            ORDER BY contract_symbol
        """

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn)

        return {
            "symbols": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Forward Curve Endpoints
@app.get("/api/futures/forward-curve")
async def get_forward_curve(
    symbol: str,
    curve_date: Optional[date] = None
):
    """Get forward curve for a specific symbol on a given date"""
    try:
        if curve_date is None:
            curve_date = date.today()
        
        query = """
            SELECT 
                date,
                contract_symbol as symbol,
                contract_month,
                expiration_date,
                settlement_price as price,
                high,
                low,
                prior_settlement as open,
                change
            FROM futures_prices
            WHERE contract_symbol = %(symbol)s
              AND contract_month != 'CONTINUOUS'
              AND date = %(date)s
              AND source = 'YAHOO_FINANCE'
            ORDER BY expiration_date
        """
        
        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'symbol': symbol, 'date': curve_date})
        
        if df.empty:
            # Try to find closest available date
            query_closest = """
                SELECT DISTINCT date
                FROM futures_prices
                WHERE contract_symbol = %(symbol)s
                  AND contract_month != 'CONTINUOUS'
                  AND source = 'YAHOO_FINANCE'
                ORDER BY ABS(EXTRACT(EPOCH FROM (date - %(date)s::date)))
                LIMIT 1
            """
            with db_manager.engine.connect() as conn:
                closest_df = pd.read_sql(query_closest, conn, params={'symbol': symbol, 'date': curve_date})
            
            if not closest_df.empty:
                closest_date = closest_df['date'].iloc[0]
                # Retry with closest date
                with db_manager.engine.connect() as conn:
                    df = pd.read_sql(query, conn, params={'symbol': symbol, 'date': closest_date})
                curve_date = closest_date
            else:
                raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
        
        return {
            "symbol": symbol,
            "date": str(curve_date),
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/futures/available-dates")
async def get_available_curve_dates(symbol: str):
    """Get list of available dates for forward curves for a specific symbol"""
    try:
        query = """
            SELECT DISTINCT 
                date,
                COUNT(DISTINCT contract_month) as num_contracts
            FROM futures_prices
            WHERE contract_symbol = %(symbol)s
              AND contract_month != 'CONTINUOUS'
              AND source = 'YAHOO_FINANCE'
            GROUP BY date
            HAVING COUNT(DISTINCT contract_month) >= 2
            ORDER BY date DESC
            LIMIT 500
        """
        
        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'symbol': symbol})
        
        return {
            "symbol": symbol,
            "dates": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# SOFR Endpoints
@app.get("/api/sofr/term-rates")
async def get_sofr_term_rates(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get SOFR term averages (30D, 90D, 180D)"""
    try:
        query = """
            SELECT 
                date,
                maturity,
                rate,
                source
            FROM treasury_rates
            WHERE maturity IN ('30D', '90D', '180D')
              AND source = 'FRED_SOFR'
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date

        query += " ORDER BY date DESC, maturity"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sofr/futures-prices")
async def get_sofr_futures(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    symbol: Optional[str] = None
):
    """Get SOFR futures prices (SR1, SR3)"""
    try:
        query = """
            SELECT 
                date,
                contract_symbol as symbol,
                contract_month,
                expiration_date,
                settlement_price as price,
                high,
                low,
                change
            FROM futures_prices
            WHERE contract_symbol IN ('SR1', 'SR3')
              AND contract_month != 'CONTINUOUS'
              AND source = 'YAHOO_FINANCE'
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date
        if symbol:
            query += " AND contract_symbol = %(symbol)s"
            params['symbol'] = symbol

        query += " ORDER BY date DESC, expiration_date"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sofr/forward-curve")
async def get_sofr_forward_curve(
    curve_date: Optional[date] = None,
    symbol: str = 'SR3'
):
    """Get SOFR forward curve calculated from term rates"""
    try:
        if curve_date is None:
            curve_date = date.today()
        
        # Get SOFR term rates for the specified date
        query = """
            SELECT 
                date,
                maturity,
                rate
            FROM treasury_rates
            WHERE source = 'FRED_SOFR'
              AND date = %(date)s
            ORDER BY maturity
        """
        
        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params={'date': curve_date})
        
        if df.empty:
            # Try to find closest available date
            query_closest = """
                SELECT DISTINCT date
                FROM treasury_rates
                WHERE source = 'FRED_SOFR'
                ORDER BY ABS(EXTRACT(EPOCH FROM (date - %(date)s::date)))
                LIMIT 1
            """
            with db_manager.engine.connect() as conn:
                closest_df = pd.read_sql(query_closest, conn, params={'date': curve_date})
            
            if not closest_df.empty:
                closest_date = closest_df['date'].iloc[0]
                with db_manager.engine.connect() as conn:
                    df = pd.read_sql(query, conn, params={'date': closest_date})
                curve_date = closest_date
            else:
                raise HTTPException(status_code=404, detail=f"No SOFR term rate data found")
        
        # Calculate forward rates from term structure
        forward_rates = []
        
        # Get rates
        rates_dict = {row['maturity']: row['rate'] for _, row in df.iterrows()}
        
        if '30D' in rates_dict and '90D' in rates_dict:
            # 30d-60d forward (30-day rate starting in 30 days)
            r_30 = rates_dict['30D'] / 100
            r_90 = rates_dict['90D'] / 100
            forward_30_60 = ((1 + r_90 * (90/360)) / (1 + r_30 * (30/360)) - 1) * (360/60) * 100
            forward_rates.append({
                'period': '30d-60d',
                'label': '30d rate, 30d forward',
                'forward_rate': round(forward_30_60, 3),
                'days_forward': 30,
                'tenor_days': 30
            })
        
        if '30D' in rates_dict and '180D' in rates_dict:
            # 30d-150d forward (150-day rate starting in 30 days)
            r_30 = rates_dict['30D'] / 100
            r_180 = rates_dict['180D'] / 100
            forward_30_180 = ((1 + r_180 * (180/360)) / (1 + r_30 * (30/360)) - 1) * (360/150) * 100
            forward_rates.append({
                'period': '30d-180d',
                'label': '150d rate, 30d forward',
                'forward_rate': round(forward_30_180, 3),
                'days_forward': 30,
                'tenor_days': 150
            })
        
        if '90D' in rates_dict and '180D' in rates_dict:
            # 90d-180d forward (90-day rate starting in 90 days)
            r_90 = rates_dict['90D'] / 100
            r_180 = rates_dict['180D'] / 100
            forward_90_180 = ((1 + r_180 * (180/360)) / (1 + r_90 * (90/360)) - 1) * (360/90) * 100
            forward_rates.append({
                'period': '90d-180d',
                'label': '90d rate, 90d forward',
                'forward_rate': round(forward_90_180, 3),
                'days_forward': 90,
                'tenor_days': 90
            })
        
        # Add spot rates for comparison
        spot_rates = []
        maturity_order = {'30D': 30, '90D': 90, '180D': 180}
        for maturity in sorted(rates_dict.keys(), key=lambda x: maturity_order.get(x, 0)):
            spot_rates.append({
                'period': f'spot-{maturity}',
                'label': f'{maturity} Spot',
                'forward_rate': round(rates_dict[maturity], 3),
                'days_forward': 0,
                'tenor_days': maturity_order.get(maturity, 0)
            })
        
        all_rates = spot_rates + forward_rates
        
        return {
            "date": str(curve_date),
            "calculation_method": "Derived from SOFR term rates",
            "data": all_rates,
            "count": len(all_rates)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sofr/forward-rates")
async def get_sofr_forward_rates(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenor: str = '3m6m'
):
    """Get historical forward rate series (e.g., 3m3m, 6m6m)"""
    try:
        # Parse tenor (e.g., '3m6m' means 3-month rate starting 3 months from now)
        # For simplicity, we'll return the SOFR term rates as a proxy
        # In production, this would calculate actual forward rates from spot curve
        
        query = """
            SELECT 
                date,
                maturity,
                rate
            FROM treasury_rates
            WHERE source = 'FRED_SOFR'
        """
        params = {}

        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date

        query += " ORDER BY date DESC, maturity"

        with db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)

        return {
            "tenor": tenor,
            "data": df.to_dict('records'),
            "count": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Stats and metadata endpoints
@app.get("/api/stats/summary")
async def get_data_summary():
    """Get summary statistics for all data sources"""
    try:
        with db_manager.engine.connect() as conn:
            # Treasury data stats
            treasury_stats = pd.read_sql("""
                SELECT 
                    COUNT(*) as total_records,
                    MIN(date) as earliest_date,
                    MAX(date) as latest_date,
                    COUNT(DISTINCT maturity) as maturity_count
                FROM treasury_rates
            """, conn).to_dict('records')[0]

            # Fed rates stats
            fed_stats = pd.read_sql("""
                SELECT 
                    COUNT(*) as total_records,
                    MIN(date) as earliest_date,
                    MAX(date) as latest_date,
                    COUNT(DISTINCT rate_type) as rate_types
                FROM fed_rates
            """, conn).to_dict('records')[0]

            # CFTC stats
            cftc_stats = pd.read_sql("""
                SELECT 
                    COUNT(*) as total_records,
                    MIN(report_date) as earliest_date,
                    MAX(report_date) as latest_date,
                    COUNT(DISTINCT contract_name) as contract_count
                FROM cftc_cot
            """, conn).to_dict('records')[0]

        return {
            "treasury_rates": treasury_stats,
            "fed_rates": fed_stats,
            "cftc_cot": cftc_stats,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

