import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { complaintsAPI, analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FiPlusCircle, FiMap, FiClock, FiCheckCircle, FiAlertTriangle,
  FiLoader, FiMapPin, FiTrendingUp, FiEye, FiChevronDown, FiChevronUp, FiCopy
} from 'react-icons/fi';

const STATUS_COLORS = {
  submitted: 'status-submitted',
  under_review: 'status-submitted',
  assigned: 'status-assigned',
  in_progress: 'status-in_progress',
  pending_verification: 'status-in_progress',
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

export default function UserDashboard() {
  const { user, profile } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const { data } = await complaintsAPI.getAll({ sort_by: 'created_at', order: 'desc', limit: 100 });
      const mine = data.complaints?.filter(c => c.user_id === user?.id) || [];
      setComplaints(mine);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
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

  const totalComplaints = complaints.length;
  const resolved = complaints.filter(c => c.status === 'resolved').length;
  const inProgress = complaints.filter(c => ['in_progress', 'assigned', 'under_review', 'pending_verification'].includes(c.status)).length;
  const pending = complaints.filter(c => c.status === 'submitted').length;
  const duplicateOrRejected = complaints.filter(c => ['duplicate', 'rejected'].includes(c.status)).length;
  const critical = complaints.filter(c => c.severity === 'critical' || c.severity === 'high').length;

  const stats = [
    { label: 'Total Filed', value: totalComplaints, icon: <FiAlertTriangle />, color: 'text-civic-accent', bg: 'bg-civic-accent/10' },
    { label: 'Resolved', value: resolved, icon: <FiCheckCircle />, color: 'text-civic-success', bg: 'bg-emerald-500/10' },
    { label: 'In Progress', value: inProgress, icon: <FiTrendingUp />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Pending', value: pending, icon: <FiClock />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  // Non-duplicate complaints sorted by priority (highest first)
  const activeComplaints = complaints
    .filter(c => c.status !== 'duplicate')
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  const duplicateComplaints = complaints.filter(c => c.status === 'duplicate');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back, <span className="gradient-text">{profile?.full_name || 'Citizen'}</span>
          </h1>
          <p className="text-slate-400 text-sm">Your civic complaint dashboard — track issues, see progress, make an impact.</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <Link to="/submit" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-civic-accent/20">
            <FiPlusCircle /> Report Issue
          </Link>
          <Link to="/heatmap" className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-civic-border text-slate-300 hover:bg-white/5 transition-all">
            <FiMap /> View Heatmap
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Breakdown note */}
      {duplicateOrRejected > 0 && (
        <div className="glass-card p-3 mb-4 flex items-center gap-2">
          <FiCopy className="text-slate-500" size={14} />
          <p className="text-xs text-slate-500">
            {duplicateOrRejected} complaint{duplicateOrRejected > 1 ? 's' : ''} marked as duplicate/rejected (not shown below).
            Breakdown: {resolved} resolved + {inProgress} in progress + {pending} pending + {duplicateOrRejected} duplicate/rejected = {totalComplaints} total
          </p>
        </div>
      )}

      {/* Resolution Rate Bar */}
      {totalComplaints > 0 && (
        <div className="glass-card p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">Your Resolution Rate</h3>
            <span className="text-lg font-bold text-civic-accent">{totalComplaints > 0 ? ((resolved / totalComplaints) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-civic-accent to-primary-500 transition-all duration-700"
              style={{ width: `${totalComplaints > 0 ? (resolved / totalComplaints) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{resolved} resolved</span>
            <span>{totalComplaints - resolved} remaining</span>
          </div>
        </div>
      )}

      {/* High Priority Alert */}
      {critical > 0 && (
        <div className="glass-card p-4 mb-6 border-l-4 border-red-500 animate-slide-up">
          <div className="flex items-center gap-3">
            <FiAlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-medium text-white">You have {critical} high-priority complaint{critical > 1 ? 's' : ''}</p>
              <p className="text-xs text-slate-400">Critical and high severity issues are being prioritized by the system.</p>
            </div>
          </div>
        </div>
      )}

      {/* My Complaints */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">My Complaints <span className="text-sm text-slate-500 font-normal">(sorted by priority)</span></h2>
        <Link to="/track" className="text-sm text-civic-accent hover:underline flex items-center gap-1">
          <FiEye size={14} /> View All
        </Link>
      </div>

      {activeComplaints.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FiAlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No complaints yet</h3>
          <p className="text-slate-400 text-sm mb-6">Start by reporting a civic issue in your area.</p>
          <Link to="/submit" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-civic-accent to-primary-500 text-white font-semibold hover:opacity-90 transition-opacity">
            <FiPlusCircle /> Report Your First Issue
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activeComplaints.slice(0, 10).map(c => (
            <div key={c.id} className="glass-card overflow-hidden hover:border-civic-accent/30 transition-all">
              <div className="p-5 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold text-white">{c.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[c.severity]}`}>
                        {c.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 line-clamp-1">{c.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><FiClock size={11} /> {new Date(c.created_at).toLocaleDateString()}</span>
                      {c.category && <span className="capitalize text-slate-400">{c.category.replace(/_/g, ' ')}</span>}
                      {c.address && <span className="flex items-center gap-1 truncate max-w-xs"><FiMapPin size={11} /> {c.address}</span>}
                      {c.departments?.name && <span className="text-civic-accent">→ {c.departments.name}</span>}
                      {c.priority_score > 0 && <span className="text-purple-400">Priority: {(c.priority_score * 100).toFixed(0)}%</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[c.status]}`}>
                      {c.status?.replace(/_/g, ' ')}
                    </span>
                    {expanded === c.id ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expanded === c.id && (
                <div className="border-t border-civic-border/50 p-5 animate-slide-up bg-white/[0.02]">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* AI Analysis */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                        <FiTrendingUp size={13} /> AI Analysis
                      </h4>
                      {c.ai_detected_labels?.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {c.ai_detected_labels.map((label, i) => (
                            <span key={i} className="px-2 py-1 rounded-md bg-civic-accent/10 text-civic-accent text-xs">{label.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      ) : <p className="text-xs text-slate-500 mb-2">No AI labels detected</p>}
                      <p className="text-xs text-slate-500">Priority Score: <span className="text-civic-accent font-semibold">{(c.priority_score * 100).toFixed(0)}%</span></p>
                      {c.ai_analysis && Object.keys(c.ai_analysis).length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-white/[0.03] text-xs text-slate-400 space-y-1">
                          {c.ai_analysis.imageDetections?.length > 0 && (
                            <p>🔍 Visual: {c.ai_analysis.imageDetections.map(d => `${d.label.replace(/_/g,' ')} (${(d.confidence*100).toFixed(0)}%)`).join(', ')}</p>
                          )}
                          {c.ai_analysis.textCategory && <p>📝 Text Category: {c.ai_analysis.textCategory.replace(/_/g, ' ')}</p>}
                          {c.ai_analysis.textSeverity && <p>⚠️ Text Severity: {c.ai_analysis.textSeverity}</p>}
                          {c.ai_analysis.imageSeverity && <p>📷 Image Severity: {c.ai_analysis.imageSeverity}</p>}
                          {c.ai_analysis.category && <p>🏷️ AI Category: {c.ai_analysis.category.replace(/_/g, ' ')}</p>}
                          {c.ai_analysis.confidence > 0 && <p>📊 Confidence: {(c.ai_analysis.confidence * 100).toFixed(0)}%</p>}
                        </div>
                      )}
                    </div>

                    {/* Images */}
                    {c.image_urls?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-300 mb-2">Attached Images</h4>
                        <div className="flex gap-2 overflow-x-auto">
                          {c.image_urls.map((url, i) => (
                            <img key={i} src={url} alt="" className="w-24 h-24 rounded-lg object-cover border border-civic-border" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  {c.complaint_updates?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-civic-border/30">
                      <h4 className="text-sm font-medium text-slate-300 mb-2">Status History</h4>
                      <div className="space-y-2">
                        {c.complaint_updates.map((u, i) => (
                          <div key={i} className="flex items-start gap-3 text-xs">
                            <div className="mt-0.5"><FiCheckCircle className="text-civic-accent" size={13} /></div>
                            <div>
                              <span className="text-slate-300">{u.new_status?.replace(/_/g, ' ')}</span>
                              {u.comment && <span className="text-slate-500"> — {u.comment}</span>}
                              <p className="text-slate-600 mt-0.5">{new Date(u.created_at).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {activeComplaints.length > 10 && (
            <div className="text-center py-4">
              <Link to="/track" className="text-civic-accent hover:underline text-sm">
                View all {activeComplaints.length} complaints →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
