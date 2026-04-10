import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiX, FiAlertTriangle, FiCheckCircle, FiUser, FiMessageSquare, FiClipboard } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

// Isolated axios instance — does NOT trigger the global 401/logout interceptor
const notifAxios = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

const TYPE_CONFIG = {
  critical:      { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  Icon: FiAlertTriangle },
  verification:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  Icon: FiCheckCircle   },
  approval:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', Icon: FiUser          },
  message:       { color: '#a855f7', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', Icon: FiMessageSquare },
  status_update: { color: '#38bdf8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', Icon: FiClipboard     },
};

function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [read, setRead] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')); }
    catch { return new Set(); }
  });
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return; // No token — don't even try
    try {
      const res = await notifAxios.get('/admin/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data.notifications || []);
    } catch (err) {
      // Silently ignore — notifications are non-critical
      // Do NOT clear token or redirect — this is isolated from main auth
      console.warn('Notifications fetch failed:', err.response?.status, err.message);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(intervalRef.current);
  }, [user, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markAllRead = () => {
    const ids = notifications.map(n => n.id);
    const newRead = new Set([...read, ...ids]);
    setRead(newRead);
    localStorage.setItem('notif_read', JSON.stringify([...newRead]));
  };

  const dismissOne = (e, id) => {
    e.stopPropagation();
    const newRead = new Set([...read, id]);
    setRead(newRead);
    localStorage.setItem('notif_read', JSON.stringify([...newRead]));
  };

  const handleClick = (notif) => {
    dismissOne({ stopPropagation: () => {} }, notif.id);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const unreadCount = notifications.filter(n => !read.has(n.id)).length;

  if (!user) return null;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          cursor: 'pointer', color: open ? '#38bdf8' : '#94a3b8',
          padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center',
          transition: 'all 0.2s',
        }}
        title="Notifications"
      >
        <FiBell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            minWidth: '16px', height: '16px', borderRadius: '8px',
            background: '#ef4444', color: '#fff',
            fontSize: '0.625rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '360px', maxWidth: 'calc(100vw - 2rem)',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(51, 65, 85, 0.6)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          zIndex: 9999,
          animation: 'slideUp 0.2s ease-out',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.125rem 0.75rem',
            borderBottom: '1px solid rgba(51,65,85,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiBell size={16} color="#38bdf8" />
              <span style={{ color: '#f0f6fc', fontSize: '0.9375rem', fontWeight: 700 }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                  fontSize: '0.6875rem', fontWeight: 700, padding: '1px 7px',
                  borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)'
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{
                  background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)',
                  color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600,
                  padding: '3px 10px', borderRadius: '6px', cursor: 'pointer'
                }}>
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', border: 'none', color: '#64748b',
                cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center'
              }}>
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <FiBell size={32} color="#334155" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                  You're all caught up!
                </p>
                <p style={{ color: '#334155', fontSize: '0.8125rem' }}>No new notifications</p>
              </div>
            ) : (
              notifications.map(notif => {
                const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.status_update;
                const isUnread = !read.has(notif.id);
                const { Icon } = cfg;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    style={{
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      padding: '0.875rem 1.125rem',
                      background: isUnread ? cfg.bg : 'transparent',
                      borderBottom: '1px solid rgba(51,65,85,0.2)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isUnread ? cfg.bg.replace('0.08', '0.15') : 'rgba(51,65,85,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.background = isUnread ? cfg.bg : 'transparent'}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={cfg.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: isUnread ? '#f0f6fc' : '#cbd5e1',
                        fontSize: '0.8125rem', fontWeight: isUnread ? 600 : 500,
                        margin: '0 0 0.125rem', lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {notif.title}
                      </p>
                      <p style={{
                        color: '#64748b', fontSize: '0.75rem', margin: '0 0 0.25rem',
                        lineHeight: 1.4,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {notif.body}
                      </p>
                      <span style={{ color: '#475569', fontSize: '0.6875rem', fontWeight: 500 }}>
                        {timeAgo(notif.time)}
                      </span>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={(e) => dismissOne(e, notif.id)}
                      style={{
                        background: 'transparent', border: 'none', color: '#475569',
                        cursor: 'pointer', padding: '2px', flexShrink: 0,
                        display: 'flex', alignItems: 'center', borderRadius: '4px',
                        opacity: 0,
                      }}
                      className="notif-dismiss"
                      title="Dismiss"
                    >
                      <FiX size={13} />
                    </button>

                    {/* Unread dot */}
                    {isUnread && (
                      <div style={{
                        position: 'absolute', top: '50%', left: '6px',
                        transform: 'translateY(-50%)',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: cfg.color,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '0.75rem 1.125rem',
              borderTop: '1px solid rgba(51,65,85,0.3)',
              display: 'flex', justifyContent: 'center'
            }}>
              <button onClick={() => { setNotifications([]); setOpen(false); }} style={{
                background: 'transparent', border: 'none', color: '#475569',
                fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500
              }}>
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .notif-dismiss { opacity: 0 !important; transition: opacity 0.15s; }
        [style*="cursor: pointer"]:hover .notif-dismiss { opacity: 1 !important; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
