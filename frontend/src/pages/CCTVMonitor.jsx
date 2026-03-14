import { useState, useEffect } from 'react';
import { cctvAPI } from '../services/api';
import { FiMonitor, FiPlus, FiAlertTriangle, FiCamera, FiLoader, FiWifi, FiClock } from 'react-icons/fi';

export default function CCTVMonitor() {
  const [streams, setStreams] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newStream, setNewStream] = useState({ name: '', stream_url: '', stream_type: 'http', latitude: '', longitude: '' });
  const [analyzing, setAnalyzing] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [streamRes, alertRes] = await Promise.all([
        cctvAPI.getStreams(),
        cctvAPI.getAlerts()
      ]);
      setStreams(streamRes.data.streams || []);
      setAlerts(alertRes.data.alerts || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const addStream = async (e) => {
    e.preventDefault();
    try {
      await cctvAPI.addStream(newStream);
      setNewStream({ name: '', stream_url: '', stream_type: 'http', latitude: '', longitude: '' });
      setShowAdd(false);
      loadData();
    } catch (err) { console.error(err); }
  };

  const analyzeStream = async (stream) => {
    setAnalyzing(stream.id);
    try {
      await cctvAPI.analyzeFrame({ stream_id: stream.id, image_url: stream.stream_url });
      loadData();
    } catch (err) { console.error(err); }
    setAnalyzing(null);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><FiLoader className="w-8 h-8 text-civic-accent animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">CCTV Monitoring</h1>
          <p className="text-slate-400 text-sm">{streams.length} streams • {alerts.length} alerts detected</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-civic-accent/10 text-civic-accent hover:bg-civic-accent/20 transition-all">
          <FiPlus /> Add Stream
        </button>
      </div>

      {/* Add Stream Form */}
      {showAdd && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <h3 className="text-lg font-semibold text-white mb-4">Add CCTV Stream</h3>
          <form onSubmit={addStream} className="grid md:grid-cols-2 gap-4">
            <input type="text" value={newStream.name} onChange={e => setNewStream({ ...newStream, name: e.target.value })} required
              placeholder="Stream name" className="px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 outline-none focus:border-civic-accent" />
            <input type="text" value={newStream.stream_url} onChange={e => setNewStream({ ...newStream, stream_url: e.target.value })} required
              placeholder="Stream URL (http/rtsp)" className="px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 outline-none focus:border-civic-accent" />
            <input type="number" step="any" value={newStream.latitude} onChange={e => setNewStream({ ...newStream, latitude: e.target.value })}
              placeholder="Latitude" className="px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 outline-none focus:border-civic-accent" />
            <input type="number" step="any" value={newStream.longitude} onChange={e => setNewStream({ ...newStream, longitude: e.target.value })}
              placeholder="Longitude" className="px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 outline-none focus:border-civic-accent" />
            <button type="submit" className="md:col-span-2 py-2.5 rounded-lg bg-civic-accent text-white font-medium hover:opacity-90">Add Stream</button>
          </form>
        </div>
      )}

      {/* Streams Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {streams.map(stream => (
          <div key={stream.id} className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-civic-accent/10 flex items-center justify-center">
                <FiMonitor className="w-5 h-5 text-civic-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate">{stream.name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <FiWifi size={10} className={stream.is_active ? 'text-civic-success' : 'text-red-400'} />
                  {stream.stream_type.toUpperCase()} • {stream.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            {/* Stream preview placeholder */}
            <div className="w-full h-32 rounded-lg bg-slate-800 flex items-center justify-center mb-3 border border-civic-border/50">
              <FiCamera className="w-8 h-8 text-slate-600" />
            </div>

            {stream.last_analysis && Object.keys(stream.last_analysis).length > 0 && (
              <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <FiAlertTriangle size={12} /> Hazards detected in last analysis
                </p>
              </div>
            )}

            {stream.last_analyzed_at && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                <FiClock size={12} /> Last: {new Date(stream.last_analyzed_at).toLocaleString()}
              </p>
            )}

            <button onClick={() => analyzeStream(stream)} disabled={analyzing === stream.id}
              className="w-full py-2 rounded-lg bg-civic-accent/10 text-civic-accent text-sm font-medium hover:bg-civic-accent/20 transition-all disabled:opacity-50">
              {analyzing === stream.id ? 'Analyzing...' : 'Analyze Frame'}
            </button>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiAlertTriangle className="text-civic-warning" /> Recent CCTV Alerts
        </h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">No CCTV alerts yet. Analyze a stream to detect hazards.</p>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 10).map(alert => (
              <div key={alert.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center gap-4">
                <FiAlertTriangle className="w-5 h-5 text-civic-warning shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{alert.title}</p>
                  <p className="text-xs text-slate-400">{alert.description}</p>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{new Date(alert.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
