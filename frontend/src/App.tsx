import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Overview from './pages/Overview';
import YieldCurvePage from './pages/YieldCurvePage';
import SpreadsPage from './pages/SpreadsPage';
import FedRatesPage from './pages/FedRatesPage';
import FuturesPage from './pages/FuturesPage';
import ForwardCurvePage from './pages/ForwardCurvePage';
import SOFRForwardRatesPage from './pages/SOFRForwardRatesPage';
import DataTablesPage from './pages/DataTablesPage';
import LiveFuturesPage from './pages/LiveFuturesPage';
import YieldSurface3D from './pages/YieldSurface3D';
import './index.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/yield-curve" element={<YieldCurvePage />} />
          <Route path="/yield-surface-3d" element={<YieldSurface3D />} />
          <Route path="/spreads" element={<SpreadsPage />} />
          <Route path="/fed-rates" element={<FedRatesPage />} />
          <Route path="/futures" element={<FuturesPage />} />
          <Route path="/live-futures" element={<LiveFuturesPage />} />
          <Route path="/forward-curve" element={<ForwardCurvePage />} />
          <Route path="/sofr-forwards" element={<SOFRForwardRatesPage />} />
          <Route path="/data-tables" element={<DataTablesPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
