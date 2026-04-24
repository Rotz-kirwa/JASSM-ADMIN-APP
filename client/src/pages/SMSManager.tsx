import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  History, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw,
  CheckCircle2,
  XCircle,
  X,
  Save
} from 'lucide-react';
import { apiFetch } from '../lib/api';

const SMSManager = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'logs'>('templates');
  const [templates, setTemplates] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [form, setForm] = useState({ name: '', content: '', isActive: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'templates') {
        const res = await apiFetch('/sms/templates');
        if (res.ok) setTemplates(await res.json());
      } else {
        const res = await apiFetch('/sms/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        }
      }
    } catch (e) {
      console.error('Error fetching SMS data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleSave = async () => {
    try {
      if (editingTemplate) {
        const res = await apiFetch(`/sms/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        if (res.ok) { await fetchData(); setShowForm(false); setEditingTemplate(null); }
      } else {
        const res = await apiFetch('/sms/templates', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        if (res.ok) { await fetchData(); setShowForm(false); }
      }
    } catch (e) {
      console.error('Error saving template:', e);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await apiFetch(`/sms/retry/${id}`, { method: 'POST' });
      await fetchData();
    } catch (e) {
      console.error('Error retrying SMS:', e);
    }
  };

  const openEdit = (template: any) => {
    setEditingTemplate(template);
    setForm({ name: template.name, content: template.content, isActive: template.isActive });
    setShowForm(true);
  };

  const openNew = () => {
    setEditingTemplate(null);
    setForm({ name: '', content: '', isActive: false });
    setShowForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">SMS Communications</h1>
          <p className="text-slate-500">Manage automated notifications and track delivery.</p>
        </div>
        {activeTab === 'templates' && (
          <button onClick={openNew} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            <Plus size={18} />
            <span>New Template</span>
          </button>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">{editingTemplate ? 'Edit Template' : 'New Template'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Template Name</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20" placeholder="e.g. Payment Received" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Message Content</label>
                <textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={4}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-500/20 resize-none"
                  placeholder="Hi {{name}}, we received KES {{amount}}. Ref: {{transaction_code}}." />
                <p className="text-xs text-slate-400 mt-1">Available: {'{{name}}'}, {'{{amount}}'}, {'{{transaction_code}}'}, {'{{date}}'}, {'{{business_name}}'}</p>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Set as default template</span>
              </label>
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center space-x-2">
                <Save size={16} />
                <span>Save Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button onClick={() => setActiveTab('templates')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'templates' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <MessageSquare size={18} /><span>Templates</span>
        </button>
        <button onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${activeTab === 'logs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <History size={18} /><span>Delivery Logs</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : activeTab === 'templates' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-2 text-center py-16 text-slate-400">No templates yet. Create one to enable SMS notifications.</div>
          ) : templates.map((template) => (
            <div key={template.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-slate-900">{template.name}</h3>
                  {template.isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded mt-1 inline-block">Default</span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => openEdit(template)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit3 size={18} />
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-slate-600 text-sm leading-relaxed italic">"{template.content}"</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Message</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No SMS logs yet.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{log.phoneNumber}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{log.message}</td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${log.status === 'SENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {log.status === 'SENT' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>{log.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(log.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4 text-center">
                    {log.status === 'FAILED' && (
                      <button onClick={() => handleRetry(log.id)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Retry">
                        <RotateCcw size={18} />
                      </button>
                    )}
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
