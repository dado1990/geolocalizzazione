import React, { useState, useEffect } from 'react';
import { login, clearTokens, getTokens, apiFetch } from './api';
import { Line, Bus, Stop, Device } from './types';

// --- Components ---

const LoginPage = ({ onLogin }: { onLogin: (user: any) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 className="brand" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--primary)' }}>Bus Tracker Admin</h2>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: '14px' }}>{error}</div>}
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({ buses: 0, lines: 0, stops: 0, activeDevices: 0 });

  useEffect(() => {
    // In a real app, fetch statistics here
    const fetchStats = async () => {
      try {
        const [lines, buses, stops, devices] = await Promise.all([
          apiFetch<Line[]>('/fleet/lines'),
          apiFetch<Bus[]>('/devices'), // Placeholder for buses
          apiFetch<Stop[]>('/fleet/stops'),
          apiFetch<{ devices: Device[] }>('/devices?status=active')
        ]);
        setStats({
          lines: lines.length,
          buses: Array.isArray(buses) ? buses.length : 0, // Simplified
          stops: stops.length,
          activeDevices: devices.devices.length
        });
      } catch (err) {
        console.error('Error fetching stats', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid grid-3">
      <div className="card">
        <div className="badge green" style={{ marginBottom: '12px' }}>Network</div>
        <div className="mono" style={{ fontSize: '32px', fontWeight: '700' }}>{stats.lines}</div>
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Linee Trasporto Operative</div>
      </div>
      <div className="card">
        <div className="badge green" style={{ marginBottom: '12px' }}>Active Fleet</div>
        <div className="mono" style={{ fontSize: '32px', fontWeight: '700' }}>{stats.activeDevices}</div>
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Dispositivi Online</div>
      </div>
      <div className="card">
        <div className="badge red" style={{ marginBottom: '12px' }}>Total Buses</div>
        <div className="mono" style={{ fontSize: '32px', fontWeight: '700' }}>{stats.buses}</div>
        <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Autobus Registrati</div>
      </div>
    </div>
  );
};

// --- Main App ---

type View = 'dashboard' | 'lines' | 'buses' | 'stops' | 'devices';

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const { accessToken } = getTokens();
    if (accessToken) {
      // In a real app, verify the token and get user profile
      setUser({ role: 'admin' }); // Placeholder
    }
    setInitialized(true);
  }, []);

  const handleLogout = () => {
    clearTokens();
    setUser(null);
  };

  if (!initialized) return null;

  if (!user) {
    return <LoginPage onLogin={u => setUser(u)} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">BUS TRACKER <span style={{ color: 'var(--primary)', fontSize: '12px' }}>CONSOLE</span></div>
        <nav className="nav">
          <button className={currentView === 'dashboard' ? 'active' : ''} onClick={() => setCurrentView('dashboard')}>Dashboard</button>
          <button className={currentView === 'lines' ? 'active' : ''} onClick={() => setCurrentView('lines')}>Linee</button>
          <button className={currentView === 'buses' ? 'active' : ''} onClick={() => setCurrentView('buses')}>Autobus</button>
          <button className={currentView === 'stops' ? 'active' : ''} onClick={() => setCurrentView('stops')}>Fermate</button>
          <button className={currentView === 'devices' ? 'active' : ''} onClick={() => setCurrentView('devices')}>Dispositivi</button>
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button className="btn ghost" style={{ width: '100%', color: '#fff', borderColor: '#334155' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="header-row">
          <h1 style={{ fontSize: '24px', margin: 0 }}>{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h1>
          <div className="badge">Admin Session</div>
        </header>

        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'lines' && <div className="card">Gestione Linee - Prossimamente</div>}
        {currentView === 'buses' && <div className="card">Gestione Autobus - Prossimamente</div>}
        {currentView === 'stops' && <div className="card">Gestione Fermate - Prossimamente</div>}
        {currentView === 'devices' && <div className="card">Gestione Dispositivi - Prossimamente</div>}
      </main>
    </div>
  );
};

export default App;
