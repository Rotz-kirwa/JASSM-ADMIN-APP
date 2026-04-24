import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Calendar, 
  UserCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '../lib/api';

const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const limit = 12;

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (searchTerm) params.set('search', searchTerm);
        const res = await apiFetch(`/customers?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
          setPagination(data.pagination || { total: 0, pages: 1 });
        }
      } catch (e) {
        console.error('Error fetching customers:', e);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [page, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Management</h1>
          <p className="text-slate-500">View and manage your customer database based on payment history.</p>
        </div>
        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm font-medium">
          <Users size={16} />
          <span>{pagination.total} Total Customers</span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20 transition-all"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No customers found yet. They will appear after the first payment.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer) => (
              <div key={customer.id} className="group p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <UserCircle size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{customer.name || 'Unknown Customer'}</h3>
                    <div className="flex items-center text-slate-500 text-xs mt-0.5">
                      <Phone size={12} className="mr-1" />
                      <span>{customer.phoneNumber}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Spent</p>
                    <p className="font-bold text-slate-900">KES {Number(customer.totalPaid).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payments</p>
                    <p className="font-bold text-slate-900">{customer._count?.payments || 0} txns</p>
                  </div>
                </div>

                {customer.lastPaidAt && (
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <Calendar size={12} className="mr-1" />
                    <span>Last: {new Date(customer.lastPaidAt).toLocaleDateString('en-KE')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">{pagination.total} customers total</p>
            <div className="flex space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
