import React, { useState } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  ArrowUpRight,
  Filter
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

const data = [
  { name: 'Jan', amount: 45000 },
  { name: 'Feb', amount: 52000 },
  { name: 'Mar', amount: 48000 },
  { name: 'Apr', amount: 61000 },
  { name: 'May', amount: 55000 },
  { name: 'Jun', amount: 67000 },
];

const Reports = () => {
  const [range, setRange] = useState('month');

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
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-slate-900 flex items-center">
              <BarChart3 size={20} className="mr-2 text-blue-500" />
              Revenue Growth
            </h3>
            <div className="flex items-center space-x-2 bg-slate-50 p-1 rounded-lg">
              {['week', 'month', 'year'].map((r) => (
                <button 
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${range === r ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
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
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === data.length - 1 ? '#3b82f6' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-2xl text-white shadow-xl shadow-blue-500/20">
            <h3 className="text-blue-100 text-sm font-medium mb-1">Total Revenue (Year)</h3>
            <p className="text-4xl font-bold mb-6">KES 1.2M</p>
            <div className="flex items-center text-blue-100 text-sm">
              <div className="p-1 bg-white/20 rounded-lg mr-2">
                <ArrowUpRight size={16} />
              </div>
              <span>24% increase from last year</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Summary Metrics</h3>
            <div className="space-y-4">
              {[
                { label: 'Avg. Transaction', value: 'KES 2,450', color: 'bg-emerald-500' },
                { label: 'Recurring Rate', value: '64%', color: 'bg-blue-500' },
                { label: 'Refund Rate', value: '0.2%', color: 'bg-rose-500' },
              ].map((metric) => (
                <div key={metric.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-500">{metric.label}</span>
                    <span className="font-bold text-slate-900">{metric.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`${metric.color} h-full`} style={{ width: metric.value.includes('%') ? metric.value : '75%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
