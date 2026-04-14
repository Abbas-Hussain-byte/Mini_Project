import { useState, useEffect } from 'react';
import { complaintsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FiClock, FiMapPin, FiAlertTriangle, FiCheckCircle, FiImage, FiHash, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const STATUS_INFO = {
  submitted: { label: 'Submitted', color: '#64748b' },
  under_review: { label: 'Under Review', color: '#f59e0b' },
  assigned: { label: 'Assigned', color: '#38bdf8' },
  in_progress: { label: 'In Progress', color: '#a855f7' },
  pending_verification: { label: 'Pending Verification', color: '#eab308' },
  resolved: { label: 'Resolved', color: '#22c55e' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  duplicate: { label: 'Duplicate', color: '#64748b' },
};

const SEV_COLORS = { critical: '#ef4444', high: '#f59e0b', medium: '#38bdf8', low: '#22c55e' };

export default function TrackComplaint() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [details, setDetails] = useState({});

  useEffect(() => { loadComplaints(); }, []);

  const loadComplaints = async () => {
    try {
      const { data } = await complaintsAPI.getAll({ sort_by: 'created_at', order: 'desc', limit: 50 });
      const mine = data.complaints?.filter(c => c.user_id === user?.id) || [];
      setComplaints(mine);
    } catch (err) { console.error('Failed to load complaints', err); }
    setLoading(false);
  };

  const toggleExpand = async (c) => {
    if (expanded === c.id) { setExpanded(null); return; }
    setExpanded(c.id);
    if (!details[c.id]) {
      try {
        const res = await complaintsAPI.getById(c.id);
        setDetails(prev => ({ ...prev, [c.id]: res.data.complaint }));
      } catch (err) { console.error(err); }
    }
  };

  const shortId = (id) => id ? id.substring(0, 8).toUpperCase() : '—';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading your complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '5rem 1.25rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ color: '#f0f6fc', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.375rem' }}>My Complaints</h1>
        <p style={{ color: '#64748b', fontSize: '0.9375rem', marginBottom: '2rem' }}>Track the status of your submitted civic issues</p>

        {complaints.length === 0 ? (
          <div style={{ background: 'rgba(22, 27, 34, 0.85)', borderRadius: '14px', padding: '3rem', textAlign: 'center', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <FiAlertTriangle size={40} color="#475569" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>You haven't submitted any complaints yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {complaints.map(c => {
              const statusInfo = STATUS_INFO[c.status] || STATUS_INFO.submitted;
              const det = details[c.id];
              return (
                <div key={c.id} style={{
                  background: 'rgba(22, 27, 34, 0.85)', borderRadius: '14px', border: '1px solid rgba(51, 65, 85, 0.4)',
                  borderLeft: `3px solid ${statusInfo.color}`, overflow: 'hidden', transition: 'all 0.2s'
                }}>
                  {/* Main Row */}
                  <div onClick={() => toggleExpand(c)} style={{
                    display: 'flex', gap: '0.75rem', padding: '1rem 1.25rem', cursor: 'pointer', alignItems: 'center'
                  }}>
                    {/* Thumbnail */}
                    {c.image_urls?.length > 0 ? (
                      <img src={c.image_urls[0]} alt="" style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(51,65,85,0.4)' }} />
                    ) : (
                      <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FiImage color="#475569" size={20} />
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>#{shortId(c.id)}</span>
                        <h3 style={{ color: '#f0f6fc', fontSize: '0.9375rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8125rem', padding: '2px 8px', borderRadius: '6px', background: statusInfo.color + '18', color: statusInfo.color, fontWeight: 600 }}>{statusInfo.label}</span>
                        <span style={{ fontSize: '0.8125rem', padding: '2px 8px', borderRadius: '6px', background: (SEV_COLORS[c.severity] || '#64748b') + '18', color: SEV_COLORS[c.severity] || '#64748b', fontWeight: 600 }}>{c.severity}</span>
                        {c.category && <span style={{ fontSize: '0.8125rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(100,116,139,0.1)', color: '#94a3b8', fontWeight: 500 }}>{c.category?.replace(/_/g, ' ')}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FiClock size={11} /> {new Date(c.created_at).toLocaleDateString()}</span>
                        {c.departments?.name && <span style={{ color: '#38bdf8' }}>→ {c.departments.name}</span>}
                      </div>
                    </div>

                    {/* Expand Toggle */}
                    <div style={{ flexShrink: 0, color: '#64748b' }}>
                      {expanded === c.id ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                    </div>
                  </div>

                  {/* ===== EXPANDED DETAIL ===== */}
                  {expanded === c.id && (
                    <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(51,65,85,0.3)' }}>
                      {/* Description */}
                      <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0.875rem 0', lineHeight: 1.6 }}>{c.description}</p>

                      {/* Photos */}
                      {c.image_urls?.length > 0 && (
                        <div style={{ marginBottom: '0.875rem' }}>
                          <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', marginBottom: '0.5rem', fontWeight: 700 }}>📷 Photos ({c.image_urls.length})</p>
                          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                            {c.image_urls.map((url, i) => (
                              <img key={i} src={url} alt="" style={{ width: '120px', height: '120px', borderRadius: '10px', objectFit: 'cover', cursor: 'pointer', border: '1px solid rgba(51,65,85,0.4)', transition: 'transform 0.2s', flexShrink: 0 }}
                                onClick={() => window.open(url, '_blank')} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tracking Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.875rem' }}>
                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                          <p style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.125rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tracking ID</p>
                          <p style={{ color: '#38bdf8', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'monospace', margin: 0 }}>{shortId(c.id)}</p>
                        </div>
                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                          <p style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.125rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</p>
                          <p style={{ color: '#a855f7', fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>{(c.priority_score * 100).toFixed(0)}%</p>
                        </div>
                        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                          <p style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.125rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</p>
                          <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontWeight: 500, margin: 0 }}>{c.departments?.name || 'Pending'}</p>
                        </div>
                        {c.address && (
                          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', gridColumn: 'span 2' }}>
                            <p style={{ color: '#475569', fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.125rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</p>
                            <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontWeight: 500, margin: 0 }}>{c.address}</p>
                          </div>
                        )}
                      </div>

                      {/* AI labels */}
                      {c.ai_detected_labels?.length > 0 && (
                        <div style={{ marginBottom: '0.875rem' }}>
                          <p style={{ color: '#38bdf8', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.375rem' }}>🤖 AI Detected</p>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {c.ai_detected_labels.map((l, i) => (
                              <span key={i} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 500, border: '1px solid rgba(56,189,248,0.12)' }}>{l.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status Timeline */}
                      {(det?.complaint_updates || []).length > 0 && (
                        <div>
                          <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>📜 Status Timeline</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {(det?.complaint_updates || []).map((upd, i) => (
                              <div key={i} style={{
                                padding: '0.5rem 0.75rem', borderRadius: '8px', borderLeft: `3px solid ${upd.comment?.includes('[ADMIN MESSAGE]') ? '#a855f7' : '#334155'}`,
                                background: upd.comment?.includes('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.04)' : 'rgba(0,0,0,0.1)'
                              }}>
                                <p style={{ color: '#cbd5e1', fontSize: '0.8125rem', margin: 0, fontWeight: 400 }}>{upd.comment?.replace('[ADMIN MESSAGE] ', '📩 ')}</p>
                                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem' }}>
                                  <span>{upd.profiles?.full_name || 'System'}</span>
                                  <span>• {new Date(upd.created_at).toLocaleString()}</span>
                                  {upd.old_status && upd.new_status && (
                                    <span style={{ color: '#38bdf8' }}>{upd.old_status.replace(/_/g, ' ')} → {upd.new_status.replace(/_/g, ' ')}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
