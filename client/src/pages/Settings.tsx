import React, { useMemo, useState } from 'react';
import { CheckCircle2, Link2, Loader2, XCircle } from 'lucide-react';
import API_BASE, { apiFetch } from '../lib/api';

const Settings = () => {
  const [baseUrl, setBaseUrl] = useState(() => API_BASE.replace(/\/api\/?$/, ''));
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const urls = useMemo(() => {
    const normalized = baseUrl.replace(/\/$/, '');
    return {
      validation: `${normalized}/api/payments/c2b/validation`,
      confirmation: `${normalized}/api/payments/c2b/confirmation`,
    };
  }, [baseUrl]);

  const registerUrls = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const res = await apiFetch('/payments/c2b/register', {
        method: 'POST',
        body: JSON.stringify({ baseUrl: baseUrl.replace(/\/$/, '') }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.message || 'Could not register C2B URLs.');
        return;
      }

      setStatus('success');
      setMessage(data.message || 'C2B URLs registered successfully.');
    } catch (error) {
      setStatus('error');
      setMessage('Could not reach the API. Please try again.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage production payment callback configuration.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center">
              <Link2 size={18} className="mr-2 text-blue-500" />
              M-Pesa C2B Callback URLs
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Register these URLs with Safaricom for manual Till payments.
            </p>
          </div>
        </div>

        <label className="text-sm font-medium text-slate-700 block mb-2">Public API Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20"
          placeholder="https://jassm-admin-app.onrender.com"
        />

        <div className="mt-5 space-y-3">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Validation URL</p>
            <p className="font-mono text-sm text-slate-700 break-all">{urls.validation}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Confirmation URL</p>
            <p className="font-mono text-sm text-slate-700 break-all">{urls.confirmation}</p>
          </div>
        </div>

        {message && (
          <div className={`mt-5 flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            {status === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{message}</span>
          </div>
        )}

        <button
          onClick={registerUrls}
          disabled={status === 'loading'}
          className="mt-6 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
          <span>{status === 'loading' ? 'Registering...' : 'Register C2B URLs'}</span>
        </button>
      </div>
    </div>
  );
};

export default Settings;
