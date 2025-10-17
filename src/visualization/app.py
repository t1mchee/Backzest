"""Streamlit dashboard for interest rates data visualization."""

import sys
from pathlib import Path
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from loguru import logger

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.database.connection import get_db_manager
from src.utils.config import get_config


# Page configuration
st.set_page_config(
    page_title="Interest Rates Dashboard",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)


class DashboardData:
    """Data loader for dashboard."""
    
    def __init__(self):
        """Initialize data loader."""
        self.db_manager = get_db_manager()
        self.config = get_config()
    
    @st.cache_data(ttl=3600)
    def get_treasury_rates(_self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> pd.DataFrame:
        """Get Treasury rates data."""
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
        
        query += " ORDER BY date, maturity"
        
        with _self.db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params, parse_dates=['date'])
        
        return df
    
    @st.cache_data(ttl=3600)
    def get_fed_rates(_self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> pd.DataFrame:
        """Get Fed rates data."""
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
        
        query += " ORDER BY date, rate_type"
        
        with _self.db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params, parse_dates=['date'])
        
        return df
    
    @st.cache_data(ttl=3600)
    def get_futures_prices(_self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> pd.DataFrame:
        """Get futures prices data."""
        query = """
            SELECT date, contract_symbol, contract_month, settlement_price, 
                   high, low, source
            FROM futures_prices
            WHERE 1=1
        """
        params = {}
        
        if start_date:
            query += " AND date >= %(start_date)s"
            params['start_date'] = start_date
        if end_date:
            query += " AND date <= %(end_date)s"
            params['end_date'] = end_date
        
        query += " ORDER BY date, contract_symbol, contract_month"
        
        with _self.db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params)
        
        return df
    
    @st.cache_data(ttl=3600)
    def get_cftc_cot(_self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> pd.DataFrame:
        """Get CFTC COT data."""
        query = """
            SELECT report_date, contract_name, 
                   open_interest_all,
                   noncomm_positions_long, noncomm_positions_short,
                   comm_positions_long, comm_positions_short,
                   pct_noncomm_long, pct_noncomm_short
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
        
        query += " ORDER BY report_date, contract_name"
        
        with _self.db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn, params=params, parse_dates=['report_date'])
        
        return df
    
    @st.cache_data(ttl=3600)
    def get_data_quality(_self) -> pd.DataFrame:
        """Get data quality summary."""
        query = """
            SELECT * FROM v_data_quality_summary
        """
        
        with _self.db_manager.engine.connect() as conn:
            df = pd.read_sql(query, conn)
        
        return df


def plot_yield_curve(df: pd.DataFrame, selected_dates: List[date]) -> go.Figure:
    """Plot yield curve for selected dates."""
    # Maturity ordering
    maturity_order = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y']
    maturity_months = {
        '1M': 1/12, '3M': 3/12, '6M': 6/12, '1Y': 1, '2Y': 2, '3Y': 3,
        '5Y': 5, '7Y': 7, '10Y': 10, '20Y': 20, '30Y': 30
    }
    
    fig = go.Figure()
    
    for selected_date in selected_dates:
        # Convert to date for comparison (handles both Timestamp and date objects)
        if hasattr(selected_date, 'date'):
            compare_date = selected_date.date()
        else:
            compare_date = selected_date
            
        # Filter by date (comparing date parts only, ignoring time)
        date_data = df[df['date'].dt.date == compare_date].copy()
        
        if len(date_data) == 0:
            continue
        
        # Remove duplicates (keep first, which is usually FRED)
        date_data = date_data.drop_duplicates(subset=['maturity'], keep='first')
        
        # Filter and sort by maturity
        date_data = date_data[date_data['maturity'].isin(maturity_order)].copy()
        
        if len(date_data) == 0:
            continue
            
        date_data['maturity_months'] = date_data['maturity'].map(maturity_months)
        date_data = date_data.sort_values('maturity_months')
        
        # Use maturity labels in the correct order
        fig.add_trace(go.Scatter(
            x=date_data['maturity'].tolist(),
            y=date_data['rate'].tolist(),
            mode='lines+markers',
            name=str(compare_date),
            line=dict(width=3),
            marker=dict(size=10)
        ))
    
    fig.update_layout(
        title='US Treasury Yield Curve',
        xaxis=dict(
            title='Maturity',
            categoryorder='array',
            categoryarray=maturity_order
        ),
        yaxis_title='Yield (%)',
        hovermode='x unified',
        height=500,
        template='plotly_white',
        showlegend=True
    )
    
    return fig


def plot_rate_history(df: pd.DataFrame, maturities: List[str]) -> go.Figure:
    """Plot historical rates for selected maturities."""
    fig = go.Figure()
    
    for maturity in maturities:
        maturity_data = df[df['maturity'] == maturity].sort_values('date')
        
        fig.add_trace(go.Scatter(
            x=maturity_data['date'],
            y=maturity_data['rate'],
            mode='lines',
            name=maturity,
            line=dict(width=2)
        ))
    
    fig.update_layout(
        title='Treasury Rates History',
        xaxis_title='Date',
        yaxis_title='Yield (%)',
        hovermode='x unified',
        height=500,
        template='plotly_white'
    )
    
    return fig


def plot_yield_spreads(df: pd.DataFrame) -> go.Figure:
    """Plot yield curve spreads (2s10s, 10s30s, etc.)."""
    # Remove duplicates by taking the first entry for each date/maturity combination
    df_clean = df.drop_duplicates(subset=['date', 'maturity'], keep='first')
    
    # Calculate spreads
    df_pivot = df_clean.pivot(index='date', columns='maturity', values='rate')
    
    fig = make_subplots(rows=2, cols=1, subplot_titles=['2s10s Spread', '5s30s Spread'])
    
    if '10Y' in df_pivot.columns and '2Y' in df_pivot.columns:
        spread_2s10s = df_pivot['10Y'] - df_pivot['2Y']
        # Drop NaN values
        spread_2s10s = spread_2s10s.dropna()
        fig.add_trace(
            go.Scatter(x=spread_2s10s.index, y=spread_2s10s.values, 
                      mode='lines', name='2s10s', line=dict(color='blue', width=2)),
            row=1, col=1
        )
        # Add zero line
        fig.add_hline(y=0, line_dash="dash", line_color="red", row=1, col=1)
    
    if '30Y' in df_pivot.columns and '5Y' in df_pivot.columns:
        spread_5s30s = df_pivot['30Y'] - df_pivot['5Y']
        # Drop NaN values
        spread_5s30s = spread_5s30s.dropna()
        fig.add_trace(
            go.Scatter(x=spread_5s30s.index, y=spread_5s30s.values,
                      mode='lines', name='5s30s', line=dict(color='green', width=2)),
            row=2, col=1
        )
        fig.add_hline(y=0, line_dash="dash", line_color="red", row=2, col=1)
    
    fig.update_xaxes(title_text="Date")
    fig.update_yaxes(title_text="Spread (bps)", row=1, col=1)
    fig.update_yaxes(title_text="Spread (bps)", row=2, col=1)
    
    fig.update_layout(
        height=700,
        showlegend=True,
        template='plotly_white',
        title_text='Yield Curve Spreads'
    )
    
    return fig


def plot_cot_positioning(df: pd.DataFrame, contract: str) -> go.Figure:
    """Plot COT positioning for a contract."""
    contract_data = df[df['contract_name'] == contract].sort_values('report_date')
    
    fig = make_subplots(
        rows=2, cols=1,
        subplot_titles=['Net Positioning', 'Percentage of Open Interest'],
        vertical_spacing=0.15
    )
    
    # Calculate net positions
    contract_data['net_noncomm'] = contract_data['noncomm_positions_long'] - contract_data['noncomm_positions_short']
    contract_data['net_comm'] = contract_data['comm_positions_long'] - contract_data['comm_positions_short']
    
    # Net positioning
    fig.add_trace(
        go.Scatter(x=contract_data['report_date'], y=contract_data['net_noncomm'],
                  mode='lines', name='Non-Commercial Net', line=dict(color='blue')),
        row=1, col=1
    )
    fig.add_trace(
        go.Scatter(x=contract_data['report_date'], y=contract_data['net_comm'],
                  mode='lines', name='Commercial Net', line=dict(color='red')),
        row=1, col=1
    )
    fig.add_hline(y=0, line_dash="dash", line_color="gray", row=1, col=1)
    
    # Percentage of OI
    fig.add_trace(
        go.Scatter(x=contract_data['report_date'], y=contract_data['pct_noncomm_long'],
                  mode='lines', name='% Long', line=dict(color='green')),
        row=2, col=1
    )
    fig.add_trace(
        go.Scatter(x=contract_data['report_date'], y=contract_data['pct_noncomm_short'],
                  mode='lines', name='% Short', line=dict(color='orange')),
        row=2, col=1
    )
    
    fig.update_xaxes(title_text="Date")
    fig.update_yaxes(title_text="Net Contracts", row=1, col=1)
    fig.update_yaxes(title_text="Percentage (%)", row=2, col=1)
    
    fig.update_layout(
        height=700,
        showlegend=True,
        template='plotly_white',
        title_text=f'CFTC Positioning: {contract}'
    )
    
    return fig


def main():
    """Main dashboard application."""
    st.title("📈 Interest Rates Data Dashboard")
    
    # Initialize data loader
    try:
        data_loader = DashboardData()
    except Exception as e:
        st.error(f"Failed to connect to database: {e}")
        st.info("Make sure PostgreSQL is running and the database is initialized.")
        return
    
    # Sidebar
    st.sidebar.title("Navigation")
    page = st.sidebar.radio(
        "Select Page",
        ["Yield Curve", "Rate History", "Spreads", "Policy Rates", "Futures & COT", "Data Quality"]
    )
    
    # Date range selector
    st.sidebar.markdown("---")
    st.sidebar.subheader("Date Range")
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        default_start = datetime.now().date() - timedelta(days=365*2)
        start_date = st.date_input("Start Date", value=default_start)
    with col2:
        end_date = st.date_input("End Date", value=datetime.now().date())
    
    # Load data
    with st.spinner("Loading data..."):
        treasury_df = data_loader.get_treasury_rates(start_date, end_date)
        fed_df = data_loader.get_fed_rates(start_date, end_date)
    
    if len(treasury_df) == 0:
        st.warning("No data available. Please run data collection first.")
        st.code("""
# To collect data, run:
python -m src.collectors.fred_collector
python -m src.collectors.treasury_collector
python -m src.collectors.cftc_collector
        """)
        return
    
    # Page routing
    if page == "Yield Curve":
        st.header("US Treasury Yield Curve")
        
        # Date selector for yield curve
        available_dates = sorted(treasury_df['date'].unique())
        
        col1, col2 = st.columns([3, 1])
        with col1:
            selected_dates = st.multiselect(
                "Select dates to compare",
                options=available_dates,
                default=[available_dates[-1]] if len(available_dates) > 0 else [],
                format_func=lambda x: x.strftime('%Y-%m-%d')
            )
        
        with col2:
            st.metric("Latest Date", available_dates[-1].strftime('%Y-%m-%d') if available_dates else "N/A")
        
        if selected_dates:
            fig = plot_yield_curve(treasury_df, selected_dates)
            st.plotly_chart(fig, use_container_width=True)
            
            # Show latest rates table
            st.subheader("Latest Rates")
            last_date = selected_dates[-1]
            if hasattr(last_date, 'date'):
                last_date = last_date.date()
            latest_data = treasury_df[treasury_df['date'].dt.date == last_date].copy()
            latest_data = latest_data.drop_duplicates(subset=['maturity'], keep='first')
            latest_data_sorted = latest_data.sort_values(
                by='maturity',
                key=lambda x: x.map({'1M': 1, '3M': 2, '6M': 3, '1Y': 4, '2Y': 5, '3Y': 6, '5Y': 7, '7Y': 8, '10Y': 9, '20Y': 10, '30Y': 11})
            )
            st.dataframe(latest_data_sorted[['maturity', 'rate', 'source']], use_container_width=True)
        else:
            st.info("Select at least one date to display the yield curve.")
    
    elif page == "Rate History":
        st.header("Treasury Rates History")
        
        available_maturities = sorted(treasury_df['maturity'].unique())
        
        selected_maturities = st.multiselect(
            "Select maturities to display",
            options=available_maturities,
            default=['2Y', '10Y', '30Y'] if all(m in available_maturities for m in ['2Y', '10Y', '30Y']) else available_maturities[:3]
        )
        
        if selected_maturities:
            fig = plot_rate_history(treasury_df, selected_maturities)
            st.plotly_chart(fig, use_container_width=True)
            
            # Summary statistics
            st.subheader("Summary Statistics")
            for maturity in selected_maturities:
                mat_data = treasury_df[treasury_df['maturity'] == maturity]['rate']
                col1, col2, col3, col4 = st.columns(4)
                col1.metric(f"{maturity} Current", f"{mat_data.iloc[-1]:.2f}%")
                col2.metric(f"{maturity} Mean", f"{mat_data.mean():.2f}%")
                col3.metric(f"{maturity} Min", f"{mat_data.min():.2f}%")
                col4.metric(f"{maturity} Max", f"{mat_data.max():.2f}%")
        else:
            st.info("Select at least one maturity to display.")
    
    elif page == "Spreads":
        st.header("Yield Curve Spreads")
        
        if len(treasury_df) > 0:
            fig = plot_yield_spreads(treasury_df)
            st.plotly_chart(fig, use_container_width=True)
            
            st.markdown("""
            **Understanding Yield Spreads:**
            - **2s10s**: Difference between 10-year and 2-year yields. Often used as recession indicator.
            - **5s30s**: Difference between 30-year and 5-year yields. Indicates long-term outlook.
            - Negative spreads (inverted curve) can signal economic uncertainty.
            """)
        else:
            st.info("Not enough data to calculate spreads.")
    
    elif page == "Policy Rates":
        st.header("Federal Reserve Policy Rates")
        
        if len(fed_df) > 0:
            fig = go.Figure()
            
            for rate_type in fed_df['rate_type'].unique():
                rate_data = fed_df[fed_df['rate_type'] == rate_type].sort_values('date')
                fig.add_trace(go.Scatter(
                    x=rate_data['date'],
                    y=rate_data['rate'],
                    mode='lines',
                    name=rate_type,
                    line=dict(width=2)
                ))
            
            fig.update_layout(
                title='Policy Rates History',
                xaxis_title='Date',
                yaxis_title='Rate (%)',
                hovermode='x unified',
                height=500,
                template='plotly_white'
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Latest rates
            st.subheader("Latest Policy Rates")
            latest_fed = fed_df.groupby('rate_type').last().reset_index()
            st.dataframe(latest_fed[['rate_type', 'date', 'rate']], use_container_width=True)
        else:
            st.info("No policy rates data available.")
    
    elif page == "Futures & COT":
        st.header("Futures & CFTC Positioning")
        
        # Load COT data
        cot_df = data_loader.get_cftc_cot(start_date, end_date)
        
        if len(cot_df) > 0:
            contracts = sorted(cot_df['contract_name'].unique())
            
            selected_contract = st.selectbox("Select Contract", contracts)
            
            if selected_contract:
                fig = plot_cot_positioning(cot_df, selected_contract)
                st.plotly_chart(fig, use_container_width=True)
                
                # Latest positioning
                st.subheader("Latest Positioning")
                latest_cot = cot_df[cot_df['contract_name'] == selected_contract].iloc[-1]
                
                col1, col2, col3 = st.columns(3)
                col1.metric("Open Interest", f"{latest_cot['open_interest_all']:,.0f}")
                col2.metric("Non-Comm Long %", f"{latest_cot['pct_noncomm_long']:.1f}%")
                col3.metric("Non-Comm Short %", f"{latest_cot['pct_noncomm_short']:.1f}%")
        else:
            st.info("No COT data available. Run CFTC collector to fetch data.")
    
    elif page == "Data Quality":
        st.header("Data Quality & Status")
        
        quality_df = data_loader.get_data_quality()
        
        if len(quality_df) > 0:
            st.subheader("Data Coverage Summary")
            st.dataframe(quality_df, use_container_width=True)
            
            # Visualization
            fig = go.Figure(data=[
                go.Bar(
                    x=quality_df['data_type'],
                    y=quality_df['total_records'],
                    text=quality_df['total_records'],
                    textposition='auto',
                )
            ])
            
            fig.update_layout(
                title='Total Records by Data Type',
                xaxis_title='Data Type',
                yaxis_title='Number of Records',
                height=400,
                template='plotly_white'
            )
            
            st.plotly_chart(fig, use_container_width=True)
            
            # Date ranges
            st.subheader("Date Ranges")
            for _, row in quality_df.iterrows():
                with st.expander(row['data_type']):
                    col1, col2, col3 = st.columns(3)
                    col1.metric("Earliest", row['earliest_date'])
                    col2.metric("Latest", row['latest_date'])
                    col3.metric("Days Covered", f"{row['days_covered']:,}")
        else:
            st.info("No data quality information available.")
    
    # Footer
    st.sidebar.markdown("---")
    st.sidebar.markdown("### About")
    st.sidebar.info(
        "Interest Rates Data Dashboard\n\n"
        "Data sources: FRED, US Treasury, CFTC\n\n"
        "Built with Streamlit & Plotly"
    )


if __name__ == "__main__":
    main()

