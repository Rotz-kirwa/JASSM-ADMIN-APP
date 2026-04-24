import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Calendar,
  Clock,
  CalendarDays,
  CalendarCheck
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { apiFetch } from '../lib/api';

const StatCard = ({ title, amount, count, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={24} />
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful Txns</p>
        <p className="text-sm font-bold text-slate-700">{count}</p>
      </div>
    </div>
    <div className="mt-4">
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mt-1">
        KES {Number(amount).toLocaleString()}
      </p>
    </div>
  </div>
);

const Dashboard = () => {
  const [summary, setSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartRange, setChartRange] = useState('last7days');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError('');

        const [summaryRes, reportsRes] = await Promise.all([
          apiFetch('/payments/summary'),
          apiFetch(`/payments/reports?range=${chartRange}`)
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }
        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setChartData(reportsData);
        }
      } catch (error: any) {
        if (error.message !== 'Unauthorized') {
          setError('Failed to load dashboard data.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [chartRange]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financial Overview</h1>
        <p className="text-slate-500">Real-time payment metrics from successful M-Pesa transactions.</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard 
          title="Today's Total" 
          amount={summary?.today?.amount || 0}
          count={summary?.today?.count || 0}
          icon={Clock} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Yesterday's Total" 
          amount={summary?.yesterday?.amount || 0}
          count={summary?.yesterday?.count || 0}
          icon={Calendar} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="This Week's Total" 
          amount={summary?.thisWeek?.amount || 0}
          count={summary?.thisWeek?.count || 0}
          icon={CalendarDays} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="This Month's Total" 
          amount={summary?.thisMonth?.amount || 0}
          count={summary?.thisMonth?.count || 0}
          icon={CalendarCheck} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Annual Total" 
          amount={summary?.thisYear?.amount || 0}
          count={summary?.thisYear?.count || 0}
          icon={CreditCard} 
          color="bg-purple-500" 
        />
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Revenue Analysis</h2>
            <p className="text-slate-500 text-sm">Revenue performance over time</p>
          </div>
          <select 
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 ring-blue-500/20 cursor-pointer"
            value={chartRange}
            onChange={(e) => setChartRange(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="thismonth">This Month</option>
            <option value="thisyear">This Year</option>
          </select>
        </div>
        <div className="h-[350px] w-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">Loading chart data...</div>
          ) : chartData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-slate-400">No transactions found for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
                  width={60}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: number) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
