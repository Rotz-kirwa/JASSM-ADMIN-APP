import React, { useState } from 'react';
import { 
  MessageSquare, 
  History, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye
} from 'lucide-react';

const SMSManager = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'logs'>('templates');

  const templates = [
    { id: '1', name: 'Payment Received', content: 'Hi {{name}}, we have received KES {{amount}}. Ref: {{transaction_code}}. Thank you.', isActive: true },
    { id: '2', name: 'Payment Reminder', content: 'Hi {{name}}, your payment is pending. Please complete it to avoid service interruption.', isActive: false },
  ];

  const logs = [
    { id: '1', phone: '254712345678', message: 'Hi John, we have received KES 1500...', status: 'SENT', date: '2024-04-24 10:31 AM' },
    { id: '2', phone: '254722345678', message: 'Hi Jane, we have received KES 2500...', status: 'FAILED', date: '2024-04-24 11:16 AM' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Communications</h1>
          <p className="text-slate-500">Manage automated notifications and track delivery.</p>
        </div>
        {activeTab === 'templates' && (
          <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            <Plus size={18} />
            <span>New Template</span>
          </button>
        )}
      </div>

      <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('templates')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'templates' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <MessageSquare size={18} />
          <span>Templates</span>
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <History size={18} />
          <span>Delivery Logs</span>
        </button>
      </div>

      {activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">{template.name}</h3>
                  {template.isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded mt-1 inline-block">Default</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit3 size={18} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-slate-600 text-sm leading-relaxed italic">"{template.content}"</p>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <span className="text-xs font-medium text-slate-400 uppercase">Available tags:</span>
                {['name', 'amount', 'code'].map(tag => (
                  <code key={tag} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{'{{' + tag + '}}'}</code>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{log.phone}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{log.message}</td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {log.status === 'SENT' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{log.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{log.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center space-x-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Detail">
                        <Eye size={18} />
                      </button>
                      {log.status === 'FAILED' && (
                        <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Retry">
                          <RotateCcw size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SMSManager;
