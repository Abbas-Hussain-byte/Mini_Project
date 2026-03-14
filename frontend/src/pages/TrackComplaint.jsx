import { useState, useEffect } from 'react';
import { complaintsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiClock, FiMapPin, FiAlertTriangle, FiCheckCircle, FiLoader } from 'react-icons/fi';

const STATUS_COLORS = {
  submitted: 'status-submitted',
  under_review: 'status-submitted',
  assigned: 'status-assigned',
  in_progress: 'status-in_progress',
  resolved: 'status-resolved',
  rejected: 'status-rejected',
  duplicate: 'status-rejected',
};

const SEVERITY_COLORS = {
  critical: 'badge-critical',
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-low',
};

export default function TrackComplaint() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      const { data } = await complaintsAPI.getAll({ sort_by: 'created_at', order: 'desc', limit: 50 });
      // Filter to user's complaints
      const mine = data.complaints?.filter(c => c.user_id === user?.id) || [];
      setComplaints(mine);
    } catch (err) {
      console.error('Failed to load complaints', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <FiLoader className="w-8 h-8 text-civic-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">My Complaints</h1>
      <p className="text-slate-400 text-sm mb-8">Track the status of your submitted issues</p>

      {complaints.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FiAlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">You haven't submitted any complaints yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map(c => (
            <div key={c.id} className="glass-card p-5 hover:border-civic-accent/30 transition-all cursor-pointer"
              onClick={() => setSelected(selected?.id === c.id ? null : c)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[c.severity]}`}>
                      {c.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-2">{c.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><FiClock /> {new Date(c.created_at).toLocaleDateString()}</span>
                    {c.address && <span className="flex items-center gap-1 truncate max-w-xs"><FiMapPin /> {c.address}</span>}
                    {c.departments?.name && <span className="text-civic-accent">→ {c.departments.name}</span>}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[c.status]}`}>
                  {c.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Expanded detail */}
              {selected?.id === c.id && (
                <div className="mt-4 pt-4 border-t border-civic-border/50 animate-slide-up">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2">AI Analysis</h4>
                      {c.ai_detected_labels?.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {c.ai_detected_labels.map((label, i) => (
                            <span key={i} className="px-2 py-1 rounded-md bg-civic-accent/10 text-civic-accent text-xs">{label}</span>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-500">Pending analysis</p>}
                      <p className="text-xs text-slate-500 mt-2">Priority Score: {(c.priority_score * 100).toFixed(0)}%</p>
                    </div>
                    {c.image_urls?.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {c.image_urls.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover border border-civic-border" />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  {c.complaint_updates?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Status History</h4>
                      <div className="space-y-2">
                        {c.complaint_updates.map((u, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <FiCheckCircle className="text-civic-accent" />
                            <span className="text-slate-400">{u.comment}</span>
                            <span className="text-slate-600">{new Date(u.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
