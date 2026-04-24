import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '../lib/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const limit = 10;

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (searchTerm) params.set('search', searchTerm);
        const res = await apiFetch(`/payments?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTransactions(data.payments || []);
          setPagination(data.pagination || { total: 0, pages: 1 });
        }
      } catch (e) {
        console.error('Error fetching transactions:', e);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchTransactions, 300);
    return () => clearTimeout(debounce);
  }, [page, searchTerm]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-emerald-100 text-emerald-700';
      case 'FAILED': return 'bg-rose-100 text-rose-700';
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 size={14} />;
      case 'FAILED': return <XCircle size={14} />;
      case 'PENDING': return <Clock size={14} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">Track and manage all M-Pesa payments.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by code, phone, or name..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Transaction Code</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-slate-700 text-sm">{tx.transactionCode}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{tx.customerName || 'Unknown'}</p>
                        <p className="text-sm text-slate-500">{tx.phoneNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">KES {Number(tx.amount).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                        {tx.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 text-sm">
                        {new Date(tx.paidAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(tx.status)}`}>
                        {getStatusIcon(tx.status)}
                        <span>{tx.status}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {pagination.total > 0 
              ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, pagination.total)} of ${pagination.total} transactions`
              : 'No transactions'}
          </p>
          <div className="flex space-x-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
