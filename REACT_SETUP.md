# React + FastAPI Setup Guide

This project now features a modern **React frontend** with **FastAPI backend** architecture.

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend**: FastAPI + PostgreSQL
- **Data Visualization**: Recharts for interactive charts
- **Styling**: Tailwind CSS for modern, responsive UI

## 🚀 Quick Start

### Option 1: Local Development (Recommended)

#### 1. Start the Backend API

```bash
# Install backend dependencies (if not already installed)
pip install -r backend/requirements.txt

# Start FastAPI server
cd backend
python main.py
# API will be available at http://localhost:8000
```

#### 2. Start the React Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
# Frontend will be available at http://localhost:5173
```

#### 3. Access the Dashboard

Open your browser to: **http://localhost:5173**

The FastAPI backend will be running on port 8000, and the React frontend on port 5173 with automatic proxy configuration.

### Option 2: Docker Compose

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker-compose up

# Access the application:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

## 📊 Features

### Dashboard Includes:

1. **Yield Curve Visualization**
   - Interactive Treasury yield curve
   - Date selector to view historical curves
   - Real-time data from FRED and Treasury.gov

2. **Treasury Spreads**
   - 10Y-2Y spread (recession indicator)
   - 10Y-3M spread
   - 2-year historical view
   - Inversion detection

3. **Futures Positioning (COT)**
   - CFTC Commitments of Traders data
   - 8 Treasury interest rate futures contracts
   - Commercial vs Non-Commercial positioning
   - Net positions and percentages of open interest

4. **Data Summary Cards**
   - Total records by source
   - Date ranges
   - Contract counts

## 🔌 API Endpoints

FastAPI provides RESTful endpoints:

### Treasury Rates
- `GET /api/treasury/rates` - Get Treasury rates with filters
- `GET /api/treasury/yield-curve` - Get yield curve for a date
- `GET /api/treasury/spreads` - Get Treasury spreads (10Y-2Y, 10Y-3M)

### Fed Rates
- `GET /api/fed/rates` - Get Federal Reserve rates

### CFTC COT
- `GET /api/cftc/cot` - Get COT data for interest rate futures
- `GET /api/cftc/contracts` - Get list of available contracts

### Stats
- `GET /api/stats/summary` - Get data summary

**API Documentation**: Visit http://localhost:8000/docs for interactive API docs

## 🛠️ Development

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Backend Development

```bash
# Run with auto-reload
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Or simply
python backend/main.py
```

## 📦 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **Recharts** - Charting library
- **Axios** - HTTP client
- **date-fns** - Date manipulation
- **Lucide React** - Icon library

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **SQLAlchemy** - ORM
- **Pandas** - Data manipulation
- **PostgreSQL** - Database

## 🎨 Customization

### Adding New Charts

1. Create a new component in `frontend/src/components/charts/`
2. Import Recharts components
3. Use the API service to fetch data
4. Add to the Dashboard page

### Adding New API Endpoints

1. Add endpoint to `backend/main.py`
2. Update `frontend/src/services/api.ts` with new function
3. Use in React components

## 🚢 Deployment

### Production Build

```bash
# Frontend
cd frontend
npm run build
# Output in frontend/dist/

# Backend
# Use gunicorn or uvicorn with workers
gunicorn backend.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Environment Variables

**Frontend** (`.env`):
```bash
VITE_API_URL=https://your-api-domain.com
```

**Backend** (`config.yaml`):
```yaml
database:
  host: your-db-host
  port: 5432
  name: interest_rates_db
  user: your-user
  password: your-password

apis:
  fred:
    api_key: your-fred-api-key
```

## 📝 Notes

- The React frontend uses Vite's proxy feature to avoid CORS issues in development
- FastAPI includes automatic CORS middleware for production deployments
- All dates are handled in ISO format (YYYY-MM-DD)
- Charts are responsive and work on mobile devices

## 🐛 Troubleshooting

### Frontend shows "Failed to fetch"
- Ensure backend is running on port 8000
- Check console for CORS errors
- Verify `.env` file has correct API URL

### Backend connection errors
- Ensure PostgreSQL is running
- Check `config.yaml` database settings
- Verify you've run `python scripts/init_database.py`

### No data showing
- Run data collection: `python scripts/collect_all.py`
- Check database has data: `psql -U your_user -d interest_rates_db`
- Verify API endpoints return data: http://localhost:8000/docs

## 📚 Resources

- [React Documentation](https://react.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Recharts Documentation](https://recharts.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vite Documentation](https://vitejs.dev/)

