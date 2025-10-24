import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, GitBranch, DollarSign, BarChart3, Table, Activity, LineChart, Radio, Box } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navItems = [
    { path: '/', icon: Home, label: 'Overview' },
    { path: '/yield-curve', icon: TrendingUp, label: 'Yield Curve' },
    { path: '/yield-surface-3d', icon: Box, label: '3D Yield Surface' },
    { path: '/spreads', icon: GitBranch, label: 'Spreads' },
    { path: '/fed-rates', icon: DollarSign, label: 'Fed Rates' },
    { path: '/futures', icon: BarChart3, label: 'Futures & COT' },
    { path: '/live-futures', icon: Radio, label: 'Live Futures' },
    { path: '/forward-curve', icon: Activity, label: 'Forward Curves' },
    { path: '/sofr-forwards', icon: LineChart, label: 'SOFR Forwards' },
    { path: '/data-tables', icon: Table, label: 'Data Tables' },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white shadow-xl">
        <div className="p-6 border-b border-blue-700">
          <h1 className="text-2xl font-bold">Interest Rates</h1>
          <p className="text-blue-200 text-sm mt-1">Analysis Platform</p>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-blue-700">
          <p className="text-xs text-blue-200">
            Data from FRED, Treasury, CFTC, TradingView
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;

