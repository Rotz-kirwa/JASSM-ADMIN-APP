import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import SMSManager from './pages/SMSManager';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Login from './pages/Login';
import { apiFetch, clearAuth, getToken } from './lib/api';

// Placeholder components
const Settings = () => <div className="p-8"><h1 className="text-2xl font-bold">Settings</h1><p className="text-slate-500">System settings coming soon...</p></div>;

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [authStatus, setAuthStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      const token = getToken();
      if (!token) {
        clearAuth();
        setAuthStatus('invalid');
        return;
      }

      try {
        const res = await apiFetch('/auth/me');
        if (!cancelled) setAuthStatus(res.ok ? 'valid' : 'invalid');
      } catch {
        if (!cancelled) setAuthStatus('invalid');
      }
    };

    setAuthStatus('checking');
    verifySession();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        Verifying session...
      </div>
    );
  }

  if (authStatus === 'invalid') {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/*" 
        element={
          <ProtectedLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/sms-templates" element={<SMSManager />} />
              <Route path="/sms-logs" element={<SMSManager />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </ProtectedLayout>
        } 
      />
    </Routes>
  );
}

export default App;
