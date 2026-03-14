import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { analyticsAPI } from '../services/api';
import { FiLoader, FiAlertTriangle } from 'react-icons/fi';
import 'leaflet/dist/leaflet.css';

const SEVERITY_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#22c55e' };
const DEFAULT_CENTER = [20.5937, 78.9629]; // India center

function HeatmapPoints({ points, clusters }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 0) {
      const lats = points.map(p => p.latitude);
      const lngs = points.map(p => p.longitude);
      map.fitBounds([
        [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
        [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01]
      ]);
    }
  }, [points, map]);

  return null;
}

export default function HeatmapPage() {
  const [points, setPoints] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await analyticsAPI.getHeatmap();
      setPoints(data.points || []);
      setClusters(data.clusters || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const filteredPoints = filter === 'all' ? points : points.filter(p => p.severity === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Civic Issue Heatmap</h1>
          <p className="text-slate-400 text-sm">{points.length} active complaints • {clusters.length} clusters</p>
        </div>
        <div className="flex gap-2">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === s ? 'bg-civic-accent text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden" style={{ height: '70vh' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full"><FiLoader className="w-8 h-8 text-civic-accent animate-spin" /></div>
        ) : (
          <MapContainer center={DEFAULT_CENTER} zoom={5} className="h-full w-full" style={{ background: '#1a2332' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
            <HeatmapPoints points={filteredPoints} clusters={clusters} />

            {/* Complaint markers */}
            {filteredPoints.map(p => (
              <CircleMarker key={p.id} center={[p.latitude, p.longitude]}
                radius={8} weight={1}
                color={SEVERITY_COLORS[p.severity] || '#f59e0b'}
                fillColor={SEVERITY_COLORS[p.severity] || '#f59e0b'}
                fillOpacity={0.6}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold capitalize">{p.category?.replace('_', ' ')}</p>
                    <p className="text-xs mt-1">Severity: <strong className="capitalize">{p.severity}</strong></p>
                    <p className="text-xs">Priority: {(p.priority_score * 100).toFixed(0)}%</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Cluster circles */}
            {clusters.map((c, i) => (
              <CircleMarker key={`cluster-${i}`} center={[c.centroid_lat, c.centroid_lng]}
                radius={Math.min(c.complaint_count * 5, 40)} weight={2}
                color="rgba(56, 189, 248, 0.8)"
                fillColor="rgba(56, 189, 248, 0.15)"
                fillOpacity={0.4}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">Cluster Hotspot</p>
                    <p className="text-xs mt-1">{c.complaint_count} complaints</p>
                    <p className="text-xs">Risk Score: {(c.risk_score * 100).toFixed(0)}%</p>
                    <p className="text-xs capitalize">Dominant: {c.dominant_category?.replace('_', ' ')}</p>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Risk Area Legend */}
      {clusters.length > 0 && (
        <div className="mt-6 glass-card p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Top Risk Areas</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {clusters.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <div className="w-8 h-8 rounded-lg bg-civic-accent/20 flex items-center justify-center">
                  <FiAlertTriangle className="w-4 h-4 text-civic-accent" />
                </div>
                <div>
                  <p className="text-sm text-white capitalize">{c.dominant_category?.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400">{c.complaint_count} issues • Risk: {(c.risk_score * 100).toFixed(0)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
