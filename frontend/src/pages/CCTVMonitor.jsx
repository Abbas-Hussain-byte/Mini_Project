import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { cctvAPI } from '../services/api';
import { FiVideo, FiPlus, FiUpload, FiAlertTriangle, FiRefreshCw, FiSearch, FiMapPin } from 'react-icons/fi';

export default function CCTVMonitor() {
  const { profile } = useAuth();
  const [streams, setStreams] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [newStream, setNewStream] = useState({ name: '', stream_url: '', stream_type: 'http', addressSearch: '' });
  const [videoFile, setVideoFile] = useState(null);
  const [videoLocation, setVideoLocation] = useState({ addressSearch: '', latitude: '', longitude: '', address: '' });
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [streamsRes, alertsRes] = await Promise.all([
        cctvAPI.getStreams().catch(() => ({ data: { streams: [] } })),
        cctvAPI.getAlerts().catch(() => ({ data: { alerts: [] } }))
      ]);
      setStreams(streamsRes.data.streams || []);
      setAlerts(alertsRes.data.alerts || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const searchStreamAddress = async () => {
    if (!newStream.addressSearch) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newStream.addressSearch)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        setNewStream(prev => ({ ...prev, latitude: data[0].lat, longitude: data[0].lon, address: data[0].display_name, addressSearch: '' }));
      }
    } catch (err) { console.warn(err); }
  };

  const searchVideoAddress = async () => {
    if (!videoLocation.addressSearch) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(videoLocation.addressSearch)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        setVideoLocation(prev => ({ ...prev, latitude: data[0].lat, longitude: data[0].lon, address: data[0].display_name, addressSearch: '' }));
      }
    } catch (err) { console.warn(err); }
  };

  const addStream = async (e) => {
    e.preventDefault();
    try {
      await cctvAPI.addStream({
        name: newStream.name,
        stream_url: newStream.stream_url,
        stream_type: newStream.stream_type,
        latitude: newStream.latitude || null,
        longitude: newStream.longitude || null
      });
      setNewStream({ name: '', stream_url: '', stream_type: 'http', addressSearch: '' });
      setShowAdd(false);
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Failed to add stream'); }
  };

  const analyzeStream = async (streamId) => {
    setLoading(true);
    try {
      const res = await cctvAPI.analyzeFrame({ stream_id: streamId });
      alert(`Analysis complete: ${res.data.alertsCreated} alerts created`);
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Analysis failed'); }
    setLoading(false);
  };

  const uploadVideo = async () => {
    if (!videoFile) return alert('Select a video file');
    if (!videoLocation.latitude || !videoLocation.longitude) return alert('Please set a location for the video');

    setUploadProgress('Uploading and analyzing...');
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('latitude', videoLocation.latitude);
      formData.append('longitude', videoLocation.longitude);

      const res = await cctvAPI.uploadVideo(formData);
      const agg = res.data.analysis?.aggregated;
      setUploadProgress(`✅ Done! ${res.data.analysis?.frames_analyzed || 0} frames analyzed. ${agg?.total_detections || 0} detections found.`);
      setVideoFile(null);
      loadData();
    } catch (err) {
      setUploadProgress(`❌ Failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const cardStyle = { background: 'rgba(22, 27, 34, 0.8)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(48, 54, 61, 0.5)' };
  const inputStyle = { width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', padding: '5rem 1rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ color: '#f0f6fc', fontSize: '1.5rem', margin: '0 0 0.25rem' }}>CCTV & Video Monitor</h1>
            <p style={{ color: '#8b949e', margin: 0, fontSize: '0.85rem' }}>Live streams and video upload analysis</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowVideoUpload(!showVideoUpload)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(168,85,247,0.2)', color: '#a855f7', fontWeight: 500, fontSize: '0.85rem' }}>
              <FiUpload /> Upload Video
            </button>
            {isAdmin && (
              <button onClick={() => setShowAdd(!showAdd)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(6,182,212,0.2)', color: '#06b6d4', fontWeight: 500, fontSize: '0.85rem' }}>
                <FiPlus /> Add Stream
              </button>
            )}
            <button onClick={loadData}
              style={{ padding: '0.6rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>
              <FiRefreshCw />
            </button>
          </div>
        </div>

        {/* Video Upload Section */}
        {showVideoUpload && (
          <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: '3px solid #a855f7' }}>
            <h3 style={{ color: '#a855f7', margin: '0 0 1rem', fontSize: '1rem' }}>📹 Upload Video for Analysis</h3>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', border: '2px dashed rgba(168,85,247,0.3)', borderRadius: '10px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)'
              }}>
                <FiVideo size={24} color="#a855f7" />
                <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
                  {videoFile ? `${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(1)}MB)` : 'Select video (MP4, WebM, MOV)'}
                </p>
                <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '0.8rem', marginBottom: '0.3rem' }}>📍 Video Location</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', padding: '0 0.5rem' }}>
                  <FiSearch color="#8b949e" size={14} />
                  <input type="text" placeholder="Search location..." value={videoLocation.addressSearch}
                    onChange={e => setVideoLocation(prev => ({ ...prev, addressSearch: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchVideoAddress())}
                    style={{ ...inputStyle, border: 'none', padding: '0.6rem 0.5rem' }} />
                </div>
                <button type="button" onClick={searchVideoAddress}
                  style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(168,85,247,0.2)', color: '#a855f7', cursor: 'pointer', fontSize: '0.8rem' }}>Search</button>
              </div>
              {videoLocation.address && <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '0.3rem 0 0' }}>📍 {videoLocation.address}</p>}
            </div>

            <button onClick={uploadVideo} disabled={!videoFile}
              style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
              🎥 Analyze Video
            </button>
            {uploadProgress && <p style={{ color: '#c9d1d9', fontSize: '0.85rem', marginTop: '0.75rem' }}>{uploadProgress}</p>}
          </div>
        )}

        {/* Add Stream Form (Admin) */}
        {showAdd && (
          <form onSubmit={addStream} style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: '3px solid #06b6d4' }}>
            <h3 style={{ color: '#06b6d4', margin: '0 0 1rem', fontSize: '1rem' }}>Add CCTV Stream</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <input placeholder="Stream name" value={newStream.name} onChange={e => setNewStream(s => ({ ...s, name: e.target.value }))} required style={inputStyle} />
              <input placeholder="Stream URL" value={newStream.stream_url} onChange={e => setNewStream(s => ({ ...s, stream_url: e.target.value }))} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', padding: '0 0.5rem' }}>
                <FiMapPin color="#8b949e" size={14} />
                <input type="text" placeholder="Search stream location..." value={newStream.addressSearch}
                  onChange={e => setNewStream(s => ({ ...s, addressSearch: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchStreamAddress())}
                  style={{ ...inputStyle, border: 'none', padding: '0.6rem 0.5rem' }} />
              </div>
              <button type="button" onClick={searchStreamAddress}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: 'none', background: 'rgba(6,182,212,0.2)', color: '#06b6d4', cursor: 'pointer', fontSize: '0.8rem' }}>Search</button>
            </div>
            {newStream.address && <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '0.3rem 0' }}>📍 {newStream.address}</p>}
            <button type="submit" style={{ marginTop: '0.75rem', padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Add Stream</button>
          </form>
        )}

        {/* Streams Grid */}
        <h2 style={{ color: '#f0f6fc', fontSize: '1.1rem', marginBottom: '0.75rem' }}>Active Streams ({streams.length})</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {streams.map(stream => (
            <div key={stream.id} style={{ ...cardStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ color: '#f0f6fc', margin: 0, fontSize: '0.95rem' }}>{stream.name}</h3>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: stream.is_active !== false ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)', color: stream.is_active !== false ? '#2ea043' : '#f85149' }}>
                  {stream.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p style={{ color: '#6e7681', fontSize: '0.75rem', margin: '0 0 0.5rem', wordBreak: 'break-all' }}>{stream.stream_url}</p>
              {stream.last_analyzed_at && (
                <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                  Last analysis: {new Date(stream.last_analyzed_at).toLocaleString()}
                </p>
              )}
              {isAdmin && (
                <button onClick={() => analyzeStream(stream.id)} disabled={loading}
                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem' }}>
                  🔍 Analyze Now
                </button>
              )}
            </div>
          ))}
          {streams.length === 0 && (
            <p style={{ color: '#8b949e', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No CCTV streams configured yet.</p>
          )}
        </div>

        {/* Recent Alerts */}
        <h2 style={{ color: '#f0f6fc', fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          <FiAlertTriangle style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
          Recent Alerts ({alerts.length})
        </h2>
        {alerts.map(alert => (
          <div key={alert.id} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${alert.severity === 'high' ? '#f59e0b' : '#06b6d4'}` }}>
            <div>
              <p style={{ color: '#f0f6fc', margin: '0 0 0.2rem', fontSize: '0.9rem' }}>{alert.title}</p>
              <p style={{ color: '#8b949e', margin: 0, fontSize: '0.75rem' }}>{alert.category?.replace(/_/g, ' ')} • {new Date(alert.created_at).toLocaleString()}</p>
            </div>
            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: alert.severity === 'high' ? 'rgba(245,158,11,0.15)' : 'rgba(6,182,212,0.15)', color: alert.severity === 'high' ? '#f59e0b' : '#06b6d4' }}>{alert.severity}</span>
          </div>
        ))}
        {alerts.length === 0 && <p style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>No alerts yet.</p>}
      </div>
    </div>
  );
}
