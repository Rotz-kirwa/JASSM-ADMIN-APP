import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download,
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { apiFetch } from '../lib/api';

const Reports = () => {
  const [range, setRange] = useState('last7days');
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const [reportsRes, summaryRes] = await Promise.all([
          apiFetch(`/payments/reports?range=${range}`),
          apiFetch('/payments/summary'),
        ]);
        if (reportsRes.ok) setChartData(await reportsRes.json());
        if (summaryRes.ok) setSummary(await summaryRes.json());
      } catch (e) {
        console.error('Error fetching reports:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [range]);

  const totalRevenue = summary?.thisYear?.amount || 0;
  const totalCount = summary?.thisYear?.count || 0;
  const avgTransaction = totalCount > 0 ? totalRevenue / totalCount : 0;

  // Find peak bar for color highlighting
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-slate-500">Analyze your business performance over time.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors">
            <Download size={18} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-slate-900 flex items-center">
              <BarChart3 size={20} className="mr-2 text-blue-500" />
              Revenue Growth
            </h3>
            <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg">
              {[
                { label: 'Today', value: 'today' },
                { label: '7 Days', value: 'last7days' },
                { label: 'Month', value: 'thismonth' },
                { label: 'Year', value: 'thisyear' },
              ].map((r) => (
                <button 
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${range === r.value ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[380px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Loading chart...</div>
            ) : chartData.length === 0 || chartData.every(d => d.revenue === 0) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <TrendingUp size={48} className="mb-3 text-slate-200" />
                <p>No payment data for this period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.revenue === maxRevenue && maxRevenue > 0 ? '#3b82f6' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Side stats */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-2xl text-white shadow-xl shadow-blue-500/20">
            <h3 className="text-blue-100 text-sm font-medium mb-1">Total Revenue (Year)</h3>
            <p className="text-4xl font-bold mb-6">KES {totalRevenue >= 1000 ? `${(totalRevenue/1000).toFixed(1)}K` : totalRevenue.toLocaleString()}</p>
            <div className="flex items-center text-blue-100 text-sm">
              <div className="p-1 bg-white/20 rounded-lg mr-2">
                <ArrowUpRight size={16} />
              </div>
              <span>{totalCount} successful transactions</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Summary Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">This Week</span>
                  <span className="font-bold text-slate-900">KES {(summary?.thisWeek?.amount || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: totalRevenue > 0 ? `${Math.min(100, ((summary?.thisWeek?.amount || 0) / totalRevenue) * 100)}%` : '0%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">This Month</span>
                  <span className="font-bold text-slate-900">KES {(summary?.thisMonth?.amount || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: totalRevenue > 0 ? `${Math.min(100, ((summary?.thisMonth?.amount || 0) / totalRevenue) * 100)}%` : '0%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-500">Avg. Transaction</span>
                  <span className="font-bold text-slate-900">KES {avgTransaction > 0 ? avgTransaction.toFixed(0) : '0'}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Today's Collections</span>
                  <span className="font-bold text-slate-900">KES {(summary?.today?.amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
