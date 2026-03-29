import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, PlusCircle, Settings as SettingsIcon, Camera, Edit2, Trash2, 
  Receipt, ChevronLeft, Save, Loader2, DollarSign, Wallet, MapPin, 
  Calendar, Tag, BarChart2, Image as ImageIcon, Download, AlertCircle, 
  CreditCard, LayoutGrid, AlignLeft, LogOut, RefreshCw, User, ShieldCheck
} from 'lucide-react';

// --- CONFIGURATION ---
const apiKey = ""; // Gemini API Key (handled by environment)
const STORAGE_KEYS = {
  EXPENSES: 'travel_tracker_expenses_v1',
  SETTINGS: 'travel_tracker_settings_v1'
};

// --- UTILS ---
const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

const getAutoEmoji = (text, type) => {
  const t = (text || "").toLowerCase();
  const cat = (type || "").toLowerCase();
  if (t.includes('starbucks') || t.includes('coffee') || t.includes('cafe')) return '☕';
  if (t.includes('mcdonald') || t.includes('burger') || t.includes('kfc')) return '🍔';
  if (t.includes('uber') || t.includes('taxi') || t.includes('grab')) return '🚕';
  if (t.includes('hotel') || t.includes('airbnb')) return '🏨';
  if (t.includes('flight') || t.includes('airline')) return '✈️';
  if (t.includes('supermarket') || t.includes('grocery')) return '🛒';
  if (cat.includes('food')) return '🍽️';
  if (cat.includes('transport')) return '🚗';
  if (cat.includes('accommodation')) return '🛌';
  return '💸';
};

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({
    defaultCurrency: 'USD',
    currencies: 'USD, EUR, GBP, JPY, HKD, AUD, CAD',
    expenseTypes: 'Food, Transport, Accommodation, Entertainment, Shopping, Other',
    paymentMethods: 'Cash, Credit Card, Debit Card, Mobile Payment'
  });

  const [statsMode, setStatsMode] = useState('type');
  const [formState, setFormState] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [notification, setNotification] = useState(null);
  const [missingFields, setMissingFields] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // --- LOCAL DATA PERSISTENCE ---
  useEffect(() => {
    // Load data from LocalStorage on mount
    try {
      const savedExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      
      if (savedExpenses) {
        setExpenses(JSON.parse(savedExpenses).sort((a, b) => new Date(b.date) - new Date(a.date)));
      }
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (e) {
      console.error("Failed to load local data", e);
    } finally {
      // Small delay for smooth transition
      setTimeout(() => setIsLoading(false), 800);
    }
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    }
  }, [expenses, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
  }, [settings, isLoading]);

  // --- ACTIONS ---
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getArrayFromSettings = (key) => {
    return settings[key].split(',').map(s => s.trim()).filter(s => s);
  };

  const getEmptyForm = () => ({
    date: new Date().toISOString().split('T')[0],
    place: '',
    amount: '',
    currency: settings.defaultCurrency,
    type: '',
    method: '',
    details: ''
  });

  const handleSaveExpense = () => {
    if (!formState.amount || !formState.place || !formState.type || !formState.method) {
      const missing = [];
      if (!formState.amount) missing.push('amount');
      if (!formState.place) missing.push('place');
      if (!formState.type) missing.push('type');
      if (!formState.method) missing.push('method');
      setMissingFields(missing);
      showNotification('Required fields missing', 'error');
      return;
    }

    let finalPlace = formState.place.trim();
    const emojiRegex = /\p{Emoji}/u;
    if (!emojiRegex.test(finalPlace)) {
      const emoji = getAutoEmoji(finalPlace, formState.type);
      finalPlace = `${emoji} ${finalPlace}`;
    }

    const expenseData = { ...formState, place: finalPlace };
    
    if (formState.id) {
      // Update existing
      setExpenses(prev => prev.map(e => e.id === formState.id ? expenseData : e));
      showNotification('Updated successfully!');
    } else {
      // Add new
      const newEntry = { ...expenseData, id: crypto.randomUUID() };
      setExpenses(prev => [newEntry, ...prev]);
      showNotification('Added successfully!');
    }
    
    setView('dashboard');
    setMissingFields([]);
  };

  const handleDeleteExpense = (id) => {
    if (!window.confirm("Delete this expense?")) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    showNotification('Deleted.');
    setView('dashboard');
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
  };

  const handleScanReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setMissingFields([]);
    
    try {
      const base64Data = await fileToBase64(file);
      const availableTypes = getArrayFromSettings('expenseTypes').join(', ');
      const availableMethods = getArrayFromSettings('paymentMethods').join(', ');

      const payload = {
        contents: [{
          role: "user",
          parts: [
            { text: `Extract from receipt: Merchant, Date (YYYY-MM-DD), Total (numeric), Currency (3-letter), Summary. 
                     Categories: [${availableTypes}]. Methods: [${availableMethods}].` },
            { inlineData: { mimeType: file.type, data: base64Data } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              date: { type: "STRING" },
              place: { type: "STRING" },
              amount: { type: "STRING" },
              currency: { type: "STRING" },
              details: { type: "STRING" },
              type: { type: "STRING" },
              method: { type: "STRING" }
            }
          }
        }
      };

      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        { method: 'POST', body: JSON.stringify(payload) }
      );

      const parsed = JSON.parse(result.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      
      setFormState(prev => ({
        ...prev,
        ...parsed,
        currency: parsed.currency?.toUpperCase() || prev.currency,
        amount: parsed.amount || prev.amount
      }));
      showNotification('Receipt scanned!', 'success');
    } catch (error) {
      showNotification('OCR failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // --- RENDER HELPERS ---
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-gray-500 font-medium">Restoring your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 flex flex-col font-sans relative shadow-2xl overflow-hidden border-x border-slate-200">
      {/* Notification Toast */}
      {notification && (
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl shadow-xl text-sm text-white font-semibold z-50 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-rose-500' : 'bg-slate-900'}`}>
          {notification.message}
        </div>
      )}

      {/* Dynamic Views */}
      <div className="flex-1 overflow-y-auto pb-28">
        {view === 'dashboard' && (
          <div className="p-4 space-y-6">
            <header className="flex justify-between items-center px-1">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Wallet</h1>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Local Storage Mode
                </p>
              </div>
              <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100">
                <User className="w-5 h-5 text-slate-400" />
              </div>
            </header>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
              <p className="text-xs font-bold opacity-70 uppercase tracking-[0.2em] mb-2">Total Expenses</p>
              {expenses.length > 0 ? (
                Object.entries(expenses.reduce((acc, curr) => {
                  acc[curr.currency] = (acc[curr.currency] || 0) + parseFloat(curr.amount || 0);
                  return acc;
                }, {})).map(([currency, total]) => (
                  <div key={currency} className="flex items-baseline gap-2 mb-1 last:mb-0">
                    <span className="text-4xl font-black tracking-tighter">{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span className="text-lg font-medium opacity-60">{currency}</span>
                  </div>
                ))
              ) : (
                <div className="text-4xl font-black tracking-tighter">0.00 <span className="text-lg font-medium opacity-60">{settings.defaultCurrency}</span></div>
              )}
            </div>

            <section>
              <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
                <button onClick={() => setView('stats')} className="text-xs font-bold text-blue-600 uppercase tracking-widest">See Stats</button>
              </div>
              {expenses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center">
                  <div className="bg-slate-50 p-4 rounded-full mb-4"><Receipt className="w-8 h-8 text-slate-300" /></div>
                  <p className="text-slate-400 font-medium">No expenses yet. Tap + to start!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.slice(0, 15).map(expense => (
                    <div key={expense.id} onClick={() => { setFormState(expense); setView('edit'); setMissingFields([]); }} 
                         className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer active:scale-[0.97] transition-all hover:border-blue-200 group">
                      <div className="flex items-center space-x-4">
                        <div className="bg-slate-50 p-3 rounded-2xl text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm leading-tight">{expense.place}</h4>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{expense.date} • {expense.type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-800">
                          {parseFloat(expense.amount).toFixed(2)}
                          <span className="text-[10px] text-slate-400 ml-1.5">{expense.currency}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {(view === 'add' || view === 'edit') && (
          <div className="bg-slate-50 min-h-full">
            <nav className="bg-white/80 backdrop-blur-md px-4 py-4 border-b flex items-center justify-between sticky top-0 z-10">
              <button onClick={() => setView('dashboard')} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-black text-slate-800">{view === 'edit' ? 'Edit Transaction' : 'New Transaction'}</h2>
              <div className="w-10 flex justify-end">
                {view === 'edit' && (
                  <button onClick={() => handleDeleteExpense(formState.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </nav>

            <div className="p-5 space-y-6">
              {/* Receipt Scanner Card */}
              <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-sm shadow-blue-50 flex flex-col items-center text-center space-y-4">
                <div className={`p-5 rounded-3xl transition-all duration-500 shadow-lg ${isScanning ? 'bg-blue-600 text-white scale-110 rotate-12' : 'bg-blue-50 text-blue-600'}`}>
                  {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{isScanning ? 'Reading Receipt...' : 'Quick AI Scan'}</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">Extract amounts and dates automatically</p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-100 active:scale-95 transition-all">Capture</button>
                  <button onClick={() => galleryInputRef.current?.click()} className="flex-1 py-3 bg-slate-50 text-slate-600 border border-slate-100 rounded-2xl text-xs font-bold active:scale-95 transition-all">Upload</button>
                </div>
                <input type="file" accept="image/*" capture="environment" onChange={handleScanReceipt} className="hidden" ref={fileInputRef} />
                <input type="file" accept="image/*" onChange={handleScanReceipt} className="hidden" ref={galleryInputRef} />
              </div>

              {/* Manual Form */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Amount</label>
                    <div className="relative">
                      <input 
                        type="number" step="0.01" value={formState.amount} 
                        onChange={e => {setFormState({...formState, amount: e.target.value}); setMissingFields(prev => prev.filter(f => f !== 'amount'));}}
                        className={`w-full border-b-2 text-3xl font-black py-2 outline-none transition-all ${missingFields.includes('amount') ? 'border-rose-300 bg-rose-50/30' : 'border-slate-50 focus:border-blue-600'}`} 
                        placeholder="0.00" 
                      />
                    </div>
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">CCY</label>
                    <select value={formState.currency} onChange={e => setFormState({...formState, currency: e.target.value})} className="w-full border-b-2 py-2.5 bg-transparent font-bold text-slate-800 outline-none border-slate-50">
                      {getArrayFromSettings('currencies').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Merchant / Place</label>
                    <input 
                      type="text" value={formState.place} 
                      onChange={e => {setFormState({...formState, place: e.target.value}); setMissingFields(prev => prev.filter(f => f !== 'place'));}}
                      className={`w-full border-b-2 py-2 outline-none font-bold text-slate-700 transition-all ${missingFields.includes('place') ? 'border-rose-300 bg-rose-50/30' : 'border-slate-50 focus:border-blue-600'}`} 
                      placeholder="e.g. Starbucks" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Details</label>
                    <textarea 
                      value={formState.details} 
                      onChange={e => setFormState({...formState, details: e.target.value})}
                      className="w-full border-b-2 py-2 outline-none border-slate-50 focus:border-blue-600 resize-none text-sm font-medium text-slate-600"
                      placeholder="Add a note..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Category</label>
                      <select 
                        value={formState.type} 
                        onChange={e => {setFormState({...formState, type: e.target.value}); setMissingFields(prev => prev.filter(f => f !== 'type'));}}
                        className={`w-full border-b-2 py-2 bg-transparent outline-none font-bold text-slate-800 ${missingFields.includes('type') ? 'border-rose-300' : 'border-slate-50'}`}
                      >
                        <option value="" disabled>Select</option>
                        {getArrayFromSettings('expenseTypes').map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Date</label>
                      <input type="date" value={formState.date} onChange={e => setFormState({...formState, date: e.target.value})} className="w-full border-b-2 py-2 outline-none font-bold text-slate-800 border-slate-50" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 block">Payment Method</label>
                    <select 
                      value={formState.method} 
                      onChange={e => {setFormState({...formState, method: e.target.value}); setMissingFields(prev => prev.filter(f => f !== 'method'));}}
                      className={`w-full border-b-2 py-2 bg-transparent outline-none font-bold text-slate-800 ${missingFields.includes('method') ? 'border-rose-300' : 'border-slate-50'}`}
                    >
                      <option value="" disabled>Select</option>
                      {getArrayFromSettings('paymentMethods').map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button onClick={handleSaveExpense} className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-slate-200 flex justify-center items-center gap-3 active:scale-95 transition-all">
                <Save className="w-5 h-5" /> Save Transaction
              </button>
            </div>
          </div>
        )}

        {view === 'stats' && (
          <div className="p-4 space-y-6">
            <header className="text-center py-4">
              <h2 className="text-2xl font-black text-slate-800">Analytics</h2>
              <div className="mt-4 inline-flex bg-slate-200/50 p-1.5 rounded-[1.5rem] backdrop-blur-sm">
                {[
                  { id: 'type', icon: LayoutGrid },
                  { id: 'method', icon: CreditCard },
                  { id: 'date', icon: Calendar }
                ].map(m => (
                  <button key={m.id} onClick={() => setStatsMode(m.id)} className={`p-2.5 px-6 rounded-2xl transition-all flex items-center gap-2 ${statsMode === m.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    <m.icon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{m.id}</span>
                  </button>
                ))}
              </div>
            </header>

            {expenses.length === 0 ? (
              <div className="py-20 flex flex-col items-center">
                <BarChart2 className="w-12 h-12 text-slate-200" />
                <p className="text-slate-400 font-bold mt-4">Add expenses to see analytics</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(expenses.reduce((acc, curr) => {
                  const key = statsMode === 'type' ? curr.type : statsMode === 'method' ? curr.method : curr.date;
                  const ccy = curr.currency;
                  if (!acc[ccy]) acc[ccy] = {};
                  acc[ccy][key] = (acc[ccy][key] || 0) + parseFloat(curr.amount || 0);
                  return acc;
                }, {})).map(([ccy, data]) => {
                  const total = Object.values(data).reduce((s, v) => s + v, 0);
                  return (
                    <div key={ccy} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                      <div className="flex justify-between items-baseline mb-6">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total {ccy}</h4>
                        <span className="text-xl font-black text-slate-800">{total.toFixed(2)}</span>
                      </div>
                      <div className="space-y-5">
                        {Object.entries(data).sort((a,b) => b[1]-a[1]).map(([label, val]) => {
                          const perc = (val / total) * 100;
                          return (
                            <div key={label}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider truncate mr-4">{label || 'Other'}</span>
                                <span className="text-[11px] font-black text-slate-900">{val.toFixed(2)}</span>
                              </div>
                              <div className="w-full bg-slate-50 h-3 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${perc}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="p-4 space-y-6">
            <header className="text-center py-4">
              <h2 className="text-2xl font-black text-slate-800">Preferences</h2>
            </header>
            
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
              <div className="flex items-center gap-4 text-blue-600 bg-blue-50 p-4 rounded-2xl">
                <ShieldCheck className="w-5 h-5" />
                <p className="text-[11px] font-bold uppercase tracking-wider leading-tight">Data is saved locally on this browser. Use export to backup.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Default Currency</label>
                  <select value={settings.defaultCurrency} onChange={e => updateSettings({...settings, defaultCurrency: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-800">
                    {getArrayFromSettings('currencies').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Categories (Comma separated)</label>
                  <textarea 
                    value={settings.expenseTypes} 
                    onChange={e => updateSettings({...settings, expenseTypes: e.target.value})} 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-medium text-slate-600 text-sm min-h-[80px]" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Payment Methods</label>
                  <textarea 
                    value={settings.paymentMethods} 
                    onChange={e => updateSettings({...settings, paymentMethods: e.target.value})} 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none font-medium text-slate-600 text-sm min-h-[80px]" 
                  />
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => {
                    const headers = ['Date', 'Merchant', 'Amount', 'Currency', 'Type', 'Method'];
                    const rows = expenses.map(e => [e.date, `"${e.place}"`, e.amount, e.currency, e.type, e.method].join(','));
                    const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
                    const link = document.createElement("a");
                    link.setAttribute("href", encodeURI(csv));
                    link.setAttribute("download", `expenses_backup_${new Date().toISOString().split('T')[0]}.csv`);
                    link.click();
                  }}
                  className="w-full py-4 border border-slate-100 rounded-2xl font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-4 h-4" /> Export CSV Backup
                </button>
                
                <button 
                  onClick={() => {
                    if (window.confirm("Danger: This will delete ALL local data permanently. Continue?")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full py-4 text-rose-500 font-bold text-sm"
                >
                  Clear Local Storage
                </button>
              </div>
            </div>

            <div className="p-2 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Version 2.0 - Local Offline Mode</p>
            </div>
          </div>
        )}
      </div>

      {/* Modern Navigation Bar */}
      <div className="absolute bottom-0 w-full bg-white/80 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center pt-3 pb-8 px-4 z-40 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <button onClick={() => setView('dashboard')} className={`flex flex-col items-center p-2 group transition-all ${view === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Home className={`w-5 h-5 mb-1.5 transition-transform ${view === 'dashboard' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setView('stats')} className={`flex flex-col items-center p-2 group transition-all ${view === 'stats' ? 'text-blue-600' : 'text-slate-400'}`}>
          <BarChart2 className={`w-5 h-5 mb-1.5 transition-transform ${view === 'stats' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Stats</span>
        </button>
        
        <div className="relative -top-8 px-2">
          <button 
            onClick={() => { setFormState(getEmptyForm()); setView('add'); setMissingFields([]); }} 
            className="bg-slate-900 text-white p-4.5 rounded-[1.75rem] shadow-2xl shadow-slate-300 hover:shadow-blue-200 hover:bg-blue-600 active:scale-90 transition-all duration-300"
          >
            <PlusCircle className="w-7 h-7" />
          </button>
        </div>

        <button onClick={() => setView('settings')} className={`flex flex-col items-center p-2 group transition-all ${view === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}>
          <SettingsIcon className={`w-5 h-5 mb-1.5 transition-transform ${view === 'settings' ? 'scale-110' : ''}`} />
          <span className="text-[9px] font-black uppercase tracking-widest">Sets</span>
        </button>
        <button onClick={() => showNotification("Cloud Sync disabled in Local Mode")} className="flex flex-col items-center p-2 group text-slate-300">
          <ShieldCheck className="w-5 h-5 mb-1.5" />
          <span className="text-[9px] font-black uppercase tracking-widest">Local</span>
        </button>
      </div>
    </div>
  );
}