import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsAPI, analyticsAPI, departmentsAPI, adminAPI } from '../services/api';
import { FiBarChart2, FiAlertTriangle, FiUsers, FiDollarSign, FiCpu, FiBriefcase, FiCheck, FiX, FiMessageSquare, FiSend, FiFilter, FiRefreshCw } from 'react-icons/fi';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const TABS = [
  { id: 'overview', label: 'Overview', icon: <FiBarChart2 /> },
  { id: 'disaster', label: '🚨 Disaster', icon: <FiAlertTriangle /> },
  { id: 'complaints', label: 'Complaints', icon: <FiAlertTriangle /> },
  { id: 'departments', label: 'Departments', icon: <FiBriefcase /> },
  { id: 'budget', label: 'Budget', icon: <FiDollarSign /> },
  { id: 'users', label: 'Users', icon: <FiUsers /> },
];

const STATUS_COLORS = {
  submitted: '#8b949e', under_review: '#f59e0b', assigned: '#06b6d4',
  in_progress: '#a855f7', pending_verification: '#eab308', resolved: '#2ea043',
  rejected: '#f85149', duplicate: '#6e7681'
};
const SEV_COLORS = { critical: '#f85149', high: '#f59e0b', medium: '#06b6d4', low: '#2ea043' };
const CHART_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#c9d1d9', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(48,54,61,0.3)' } }, y: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(48,54,61,0.3)' } } } };
const DOUGHNUT_OPTS = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#c9d1d9', font: { size: 11 }, padding: 12 } } } };
const cardStyle = { background: 'rgba(22, 27, 34, 0.8)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(48, 54, 61, 0.5)' };

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [complaints, setComplaints] = useState([]);
  const [overview, setOverview] = useState(null);
  const [deptPerformance, setDeptPerformance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [budgetResult, setBudgetResult] = useState(null);
  const [budgetLimit, setBudgetLimit] = useState('500000');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [messageText, setMessageText] = useState('');
  const [selectedComplaintMsg, setSelectedComplaintMsg] = useState(null);
  const [complaintUpdates, setComplaintUpdates] = useState({});
  const [trends, setTrends] = useState([]);
  const [disasterAlerts, setDisasterAlerts] = useState(null);
  const [deptWorkers, setDeptWorkers] = useState({});
  const [deptComplaints, setDeptComplaints] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [ov, tr, dp] = await Promise.all([
          analyticsAPI.getOverview().catch(() => ({ data: {} })),
          analyticsAPI.getTrends(30).catch(() => ({ data: { trends: [] } })),
          departmentsAPI.getPerformance().catch(() => ({ data: { performance: [] } }))
        ]);
        setOverview(ov.data);
        setTrends(tr.data.trends || []);
        setDeptPerformance(dp.data.performance || []);
      } else if (activeTab === 'complaints') {
        const params = { limit: 50 };
        if (filter.status) params.status = filter.status;
        if (filter.severity) params.severity = filter.severity;
        const res = await complaintsAPI.getAll(params);
        setComplaints(res.data.complaints || []);
      } else if (activeTab === 'disaster') {
        const res = await adminAPI.getDisasterAlerts().catch(() => ({ data: {} }));
        setDisasterAlerts(res.data);
      } else if (activeTab === 'departments') {
        const [dp, perf] = await Promise.all([
          departmentsAPI.getAll(),
          departmentsAPI.getPerformance().catch(() => ({ data: { performance: [] } }))
        ]);
        const deptList = dp.data.departments || dp.data || [];
        setDepartments(deptList);
        setDeptPerformance(perf.data.performance || []);
        // Fetch workers and complaints for each department (expanded view)
        const wMap = {};
        const cMap = {};
        await Promise.all(deptList.map(async (dept) => {
          const [wRes, cRes] = await Promise.all([
            departmentsAPI.getWorkers(dept.id).catch(() => ({ data: { workers: [] } })),
            complaintsAPI.getAll({ department_id: dept.id, limit: 20 }).catch(() => ({ data: { complaints: [] } }))
          ]);
          wMap[dept.id] = wRes.data.workers || [];
          cMap[dept.id] = cRes.data.complaints || [];
        }));
        setDeptWorkers(wMap);
        setDeptComplaints(cMap);
      } else if (activeTab === 'users') {
        const res = await adminAPI.getUsers();
        setUsers(res.data.users || []);
      }
    } catch (err) { console.error('Load error:', err); }
    setLoading(false);
  }, [activeTab, filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusUpdate = async (id, status, notes = '') => {
    try {
      await complaintsAPI.update(id, { status, notes });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Update failed'); }
  };

  const handleVerify = async (id) => {
    try {
      await complaintsAPI.verify(id, { notes: 'Resolution verified by admin' });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Verification failed'); }
  };

  const handleReject = async (id) => {
    const reason = prompt('Why is this resolution being rejected?');
    if (!reason) return;
    try {
      await complaintsAPI.rejectResolution(id, { notes: reason });
      loadData();
    } catch (err) { alert(err.response?.data?.error || 'Rejection failed'); }
  };

  const handleSendMessage = async (complaintId) => {
    if (!messageText.trim()) return;
    try {
      await adminAPI.sendMessage({ complaint_id: complaintId, message: messageText });
      setMessageText('');
      setSelectedComplaintMsg(null);
      alert('Message sent to department!');
    } catch (err) { alert('Message failed'); }
  };

  const handleRoleChange = async (userId, role) => {
    if (!confirm(`Change this user's role to ${role}?`)) return;
    try {
      await adminAPI.updateUserRole(userId, { role });
      loadData();
    } catch (err) { alert('Role update failed'); }
  };

  const runBudgetOptimization = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getPriorities({ budget_limit: budgetLimit });
      setBudgetResult(res.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadComplaintUpdates = async (id) => {
    try {
      const res = await complaintsAPI.getById(id);
      setComplaintUpdates(prev => ({ ...prev, [id]: res.data.complaint?.complaint_updates || [] }));
    } catch (err) { console.error(err); }
  };

  // ========== BUILD CHART DATA ==========
  const statusData = overview?.byStatus || {};
  const statusChartData = {
    labels: Object.keys(statusData).map(s => s.replace(/_/g, ' ')),
    datasets: [{
      data: Object.values(statusData),
      backgroundColor: Object.keys(statusData).map(s => STATUS_COLORS[s] || '#8b949e'),
      borderWidth: 0
    }]
  };

  const sevData = overview?.bySeverity || {};
  const sevChartData = {
    labels: Object.keys(sevData).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [{
      data: Object.values(sevData),
      backgroundColor: Object.keys(sevData).map(s => SEV_COLORS[s] || '#8b949e'),
      borderWidth: 0
    }]
  };

  const catData = overview?.byCategory || {};
  const catChartData = {
    labels: Object.keys(catData).slice(0, 8).map(c => c.replace(/_/g, ' ')),
    datasets: [{
      label: 'Complaints by Category',
      data: Object.values(catData).slice(0, 8),
      backgroundColor: 'rgba(6, 182, 212, 0.6)',
      borderColor: '#06b6d4',
      borderWidth: 1,
      borderRadius: 4
    }]
  };

  const trendChartData = {
    labels: trends.map(t => new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Daily Complaints',
      data: trends.map(t => t.count),
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2
    }]
  };

  const deptChartData = {
    labels: deptPerformance.map(d => d.name?.slice(0, 15) || d.code),
    datasets: [
      {
        label: 'Completed',
        data: deptPerformance.map(d => d.completed || 0),
        backgroundColor: 'rgba(46, 160, 67, 0.7)',
        borderRadius: 4
      },
      {
        label: 'Overdue',
        data: deptPerformance.map(d => d.overdue || 0),
        backgroundColor: 'rgba(248, 81, 73, 0.7)',
        borderRadius: 4
      }
    ]
  };

  return (
    <div style={{ minHeight: '100vh', padding: '5rem 1rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#f0f6fc', fontSize: '1.75rem', marginBottom: '0.25rem' }}>Admin Command Center</h1>
        <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>Welcome, {profile?.full_name || 'Admin'}</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(22, 27, 34, 0.9)', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem', overflowX: 'auto', border: '1px solid rgba(48, 54, 61, 0.5)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap',
                background: activeTab === tab.id ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                color: activeTab === tab.id ? '#06b6d4' : '#8b949e' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && <p style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>Loading...</p>}

        {/* ===== OVERVIEW TAB ===== */}
        {activeTab === 'overview' && !loading && (
          <div>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Complaints', value: overview?.total || 0, color: '#06b6d4' },
                { label: 'Submitted', value: statusData.submitted || 0, color: '#8b949e' },
                { label: 'Assigned', value: (statusData.assigned || 0) + (statusData.under_review || 0), color: '#06b6d4' },
                { label: 'In Progress', value: statusData.in_progress || 0, color: '#a855f7' },
                { label: 'Pending Verify', value: statusData.pending_verification || 0, color: '#eab308' },
                { label: 'Resolved', value: statusData.resolved || 0, color: '#2ea043' },
                { label: 'Duplicate', value: (statusData.duplicate || 0) + (statusData.rejected || 0), color: '#6e7681' },
                { label: 'Critical', value: sevData.critical || 0, color: '#f85149' },
              ].map((stat, i) => (
                <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${stat.color}`, padding: '1rem' }}>
                  <p style={{ color: '#8b949e', fontSize: '0.7rem', margin: '0 0 0.25rem' }}>{stat.label}</p>
                  <p style={{ color: '#f0f6fc', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Row 1: Status Pie + Severity Pie */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ ...cardStyle }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Complaints by Status</h3>
                <div style={{ height: '250px' }}>
                  {Object.keys(statusData).length > 0 ? (
                    <Doughnut data={statusChartData} options={DOUGHNUT_OPTS} />
                  ) : <p style={{ color: '#6e7681', textAlign: 'center', paddingTop: '4rem' }}>No data yet</p>}
                </div>
              </div>
              <div style={{ ...cardStyle }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Complaints by Severity</h3>
                <div style={{ height: '250px' }}>
                  {Object.keys(sevData).length > 0 ? (
                    <Doughnut data={sevChartData} options={DOUGHNUT_OPTS} />
                  ) : <p style={{ color: '#6e7681', textAlign: 'center', paddingTop: '4rem' }}>No data yet</p>}
                </div>
              </div>
            </div>

            {/* Charts Row 2: Category Bar + Trend Line */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ ...cardStyle }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Top Categories</h3>
                <div style={{ height: '250px' }}>
                  {Object.keys(catData).length > 0 ? (
                    <Bar data={catChartData} options={CHART_OPTS} />
                  ) : <p style={{ color: '#6e7681', textAlign: 'center', paddingTop: '4rem' }}>No data yet</p>}
                </div>
              </div>
              <div style={{ ...cardStyle }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>30-Day Trend</h3>
                <div style={{ height: '250px' }}>
                  {trends.length > 0 ? (
                    <Line data={trendChartData} options={CHART_OPTS} />
                  ) : <p style={{ color: '#6e7681', textAlign: 'center', paddingTop: '4rem' }}>No trend data yet</p>}
                </div>
              </div>
            </div>

            {/* Department Performance Bar */}
            {deptPerformance.length > 0 && (
              <div style={{ ...cardStyle }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Department Performance</h3>
                <div style={{ height: '280px' }}>
                  <Bar data={deptChartData} options={{ ...CHART_OPTS, indexAxis: 'y' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== DISASTER RESPONSE TAB ===== */}
        {activeTab === 'disaster' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#f85149', margin: 0, fontSize: '1.2rem' }}>🚨 Disaster Response Center</h2>
              <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'rgba(248,81,73,0.2)', color: '#f85149', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                <FiRefreshCw size={14} /> Refresh Alerts
              </button>
            </div>

            {disasterAlerts?.autoEscalated > 0 && (
              <div style={{ ...cardStyle, background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', marginBottom: '1rem' }}>
                <p style={{ color: '#f85149', fontWeight: 700, margin: '0 0 0.25rem' }}>⚡ {disasterAlerts.autoEscalated} complaint(s) auto-escalated just now!</p>
                <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>Critical/high complaints past their deadline were automatically escalated.</p>
              </div>
            )}

            {/* Escalated Complaints */}
            <h3 style={{ color: '#f85149', fontSize: '0.95rem', margin: '1rem 0 0.5rem' }}>🔴 Escalated Complaints ({disasterAlerts?.escalatedComplaints?.length || 0})</h3>
            {(disasterAlerts?.escalatedComplaints || []).map(c => (
              <div key={c.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: '3px solid #f85149' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '1rem' }}>{c.title}</h4>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>{c.description?.slice(0, 150)}</p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(248,81,73,0.2)', color: '#f85149' }}>ESCALATED</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '20', color: SEV_COLORS[c.severity] }}>{c.severity}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>{c.category?.replace(/_/g, ' ')}</span>
                      {c.departments?.name && <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{c.departments.name}</span>}
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Priority: {c.priority_score?.toFixed(3)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <select onChange={(e) => { if (e.target.value) handleStatusUpdate(c.id, e.target.value); e.target.value = ''; }}
                      defaultValue="" style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <option value="" disabled>Change status...</option>
                      <option value="assigned">Assign Dept</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolve</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {(disasterAlerts?.escalatedComplaints || []).length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ color: '#2ea043', fontSize: '1rem' }}>✅ No escalated complaints. All clear!</p>
              </div>
            )}

            {/* At-Risk Complaints */}
            <h3 style={{ color: '#f59e0b', fontSize: '0.95rem', margin: '1.5rem 0 0.5rem' }}>⚠️ At-Risk Complaints ({disasterAlerts?.atRiskComplaints?.length || 0})</h3>
            <p style={{ color: '#6e7681', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Critical/high complaints past deadline — may auto-escalate soon.</p>
            {(disasterAlerts?.atRiskComplaints || []).map((c, i) => (
              <div key={i} style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: '3px solid #f59e0b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '0.95rem' }}>{c.title}</h4>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '20', color: SEV_COLORS[c.severity] }}>{c.severity}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{c.hoursOverdue}hrs overdue</span>
                    </div>
                  </div>
                  <button onClick={async () => { await adminAPI.escalateComplaint(c.id); loadData(); }}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', background: 'rgba(248,81,73,0.2)', color: '#f85149', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                    🚨 Escalate Now
                  </button>
                </div>
              </div>
            ))}
            {(disasterAlerts?.atRiskComplaints || []).length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center' }}>
                <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>No at-risk complaints currently.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== COMPLAINTS TAB ===== */}
        {activeTab === 'complaints' && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <FiFilter color="#8b949e" />
              <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(48, 54, 61, 0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.85rem' }}>
                <option value="">All Statuses</option>
                {Object.keys(STATUS_COLORS).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(48, 54, 61, 0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.85rem' }}>
                <option value="">All Severities</option>
                {['low', 'medium', 'high', 'critical'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={loadData} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                <FiRefreshCw size={14} /> Refresh
              </button>
              <span style={{ color: '#6e7681', fontSize: '0.8rem' }}>({complaints.length} results)</span>
            </div>

            {complaints.map(c => (
              <div key={c.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h3 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '1rem' }}>{c.title}</h3>
                    <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>{c.description?.slice(0, 120)}{c.description?.length > 120 ? '...' : ''}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: (STATUS_COLORS[c.status] || '#8b949e') + '20', color: STATUS_COLORS[c.status] || '#8b949e' }}>{c.status?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '20', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>{c.category?.replace(/_/g, ' ')}</span>
                      {c.departments?.name && <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{c.departments.name}</span>}
                      {c.priority_score > 0 && <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>Score: {c.priority_score?.toFixed(3)}</span>}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {c.status === 'pending_verification' && (
                      <>
                        <button onClick={() => handleVerify(c.id)}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(46,160,67,0.2)', color: '#2ea043', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiCheck size={13} /> Verify
                        </button>
                        <button onClick={() => handleReject(c.id)}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(248,81,73,0.2)', color: '#f85149', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiX size={13} /> Reject
                        </button>
                      </>
                    )}

                    {!['resolved', 'rejected', 'duplicate', 'pending_verification'].includes(c.status) && (
                      <select onChange={(e) => { if (e.target.value) handleStatusUpdate(c.id, e.target.value); e.target.value = ''; }}
                        defaultValue=""
                        style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <option value="" disabled style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Change status...</option>
                        <option value="under_review" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Under Review</option>
                        <option value="assigned" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Assigned</option>
                        <option value="in_progress" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>In Progress</option>
                        <option value="pending_verification" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Pending Verification</option>
                        <option value="resolved" style={{ background: '#1a1a2e', color: '#e0e0e0' }}>Resolve (Admin Only)</option>
                      </select>
                    )}

                    <button onClick={() => { setSelectedComplaintMsg(selectedComplaintMsg === c.id ? null : c.id); loadComplaintUpdates(c.id); }}
                      style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(168,85,247,0.2)', color: '#a855f7', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FiMessageSquare size={13} /> Messages
                    </button>
                  </div>
                </div>

                {/* Messages Panel */}
                {selectedComplaintMsg === c.id && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderTop: '1px solid rgba(48,54,61,0.5)', background: 'rgba(0,0,0,0.15)', borderRadius: '0 0 8px 8px' }}>
                    {/* Existing updates/messages */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                      {(complaintUpdates[c.id] || []).map((upd, i) => (
                        <div key={i} style={{ padding: '0.4rem 0.6rem', marginBottom: '0.3rem', borderRadius: '6px', background: upd.comment?.startsWith('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.08)' : 'rgba(0,0,0,0.15)', borderLeft: `2px solid ${upd.comment?.startsWith('[ADMIN MESSAGE]') ? '#a855f7' : '#48535f'}` }}>
                          <p style={{ color: '#c9d1d9', fontSize: '0.8rem', margin: 0 }}>{upd.comment}</p>
                          <p style={{ color: '#6e7681', fontSize: '0.65rem', margin: '0.15rem 0 0' }}>
                            {upd.profiles?.full_name || 'System'} • {new Date(upd.created_at).toLocaleString()}
                            {upd.old_status && upd.new_status && ` • ${upd.old_status} → ${upd.new_status}`}
                          </p>
                        </div>
                      ))}
                      {(!complaintUpdates[c.id] || complaintUpdates[c.id].length === 0) && (
                        <p style={{ color: '#6e7681', fontSize: '0.8rem', margin: 0 }}>No messages yet</p>
                      )}
                    </div>
                    {/* Send new message */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input type="text" placeholder="Type a message to the department head..." value={messageText} onChange={e => setMessageText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage(c.id)}
                        style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none' }} />
                      <button onClick={() => handleSendMessage(c.id)}
                        style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', background: 'rgba(168,85,247,0.3)', color: '#a855f7', cursor: 'pointer' }}>
                        <FiSend />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {complaints.length === 0 && !loading && (
              <p style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>No complaints found with current filters.</p>
            )}
          </div>
        )}

        {/* ===== DEPARTMENTS TAB (EXPANDED VIEW) ===== */}
        {activeTab === 'departments' && (
          <div>
            {/* Loading state */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <FiRefreshCw style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} size={24} color="#06b6d4" />
                <p style={{ color: '#8b949e', fontSize: '0.9rem' }}>Loading departments...</p>
              </div>
            )}

            {!loading && (
              <>
            {/* Department Performance Chart */}
            {deptPerformance.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Department Performance Comparison</h3>
                <div style={{ height: '280px' }}>
                  <Bar data={deptChartData} options={CHART_OPTS} />
                </div>
              </div>
            )}

            {/* Each department — FULLY EXPANDED */}
            {departments.map(dept => (
              <div key={dept.id} style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: '3px solid #06b6d4' }}>
                {/* Department Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ color: '#f0f6fc', margin: '0 0 0.15rem', fontSize: '1.15rem' }}>{dept.name}</h3>
                    <p style={{ color: '#06b6d4', fontSize: '0.75rem', margin: 0 }}>{dept.code}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
<!--
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
//               {departments.length === 0 ? (
//                 <p style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>No departments found.</p>
//               ) : departments.map(dept => (
//                 <div key={dept.id} style={{ ...cardStyle }}>
//                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
//                     <div>
//                       <h3 style={{ color: '#f0f6fc', margin: '0 0 0.15rem', fontSize: '1.05rem' }}>{dept.name}</h3>
//                       <p style={{ color: '#06b6d4', fontSize: '0.7rem', margin: 0 }}>{dept.code}</p>
//                     </div> 
-->
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                      background: dept.is_active ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)',
                      color: dept.is_active ? '#2ea043' : '#f85149' }}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center' }}>
                    <p style={{ color: '#06b6d4', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{(deptWorkers[dept.id] || []).length || dept.total_workers || 0}</p>
                    <p style={{ color: '#6e7681', fontSize: '0.65rem', margin: 0 }}>Workers</p>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center' }}>
                    <p style={{ color: '#a855f7', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{(deptComplaints[dept.id] || []).length || dept.activeAssignments || 0}</p>
                    <p style={{ color: '#6e7681', fontSize: '0.65rem', margin: 0 }}>Complaints</p>
                  </div>
                  <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', textAlign: 'center' }}>
                    <p style={{ color: '#2ea043', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{dept.completionRate || 0}%</p>
                    <p style={{ color: '#6e7681', fontSize: '0.65rem', margin: 0 }}>Completed</p>
                  </div>
                </div>

                {/* Department Head Info */}
                {dept.head_name && (
                  <div style={{ padding: '0.6rem', background: 'rgba(245,158,11,0.05)', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.15)', marginBottom: '1rem' }}>
                    <p style={{ color: '#f59e0b', fontSize: '0.7rem', margin: '0 0 0.2rem', fontWeight: 600 }}>👤 Department Head</p>
                    <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: 0 }}>{dept.head_name}</p>
                    {dept.head_email && <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '0.1rem 0 0' }}>📧 {dept.head_email}</p>}
                    {dept.head_phone && <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '0.1rem 0 0' }}>📞 {dept.head_phone}</p>}
                  </div>
                )}

                {/* Workers List — ALWAYS VISIBLE */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ color: '#06b6d4', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>👷 Workers ({(deptWorkers[dept.id] || []).length})</h4>
                  {(deptWorkers[dept.id] || []).length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                      {(deptWorkers[dept.id] || []).map(w => (
                        <div key={w.id} style={{ padding: '0.5rem 0.7rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.4)' }}>
                          <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.1rem', fontWeight: 500 }}>{w.name}</p>
                          <p style={{ color: '#8b949e', fontSize: '0.7rem', margin: 0 }}>{w.role || 'Field Worker'} • {w.phone || 'No phone'}</p>
                          <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '3px',
                            background: w.status === 'on_duty' ? 'rgba(46,160,67,0.15)' : 'rgba(139,148,158,0.1)',
                            color: w.status === 'on_duty' ? '#2ea043' : '#8b949e' }}>{w.status || 'available'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#6e7681', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>No workers assigned to this department yet.</p>
                  )}
                </div>
<! --
                {/* Complaints List — ALWAYS VISIBLE */}
                <div>
                  <h4 style={{ color: '#a855f7', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>📋 Complaints ({(deptComplaints[dept.id] || []).length})</h4>
                  {(deptComplaints[dept.id] || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(deptComplaints[dept.id] || []).map(c => (
                        <div key={c.id} style={{ padding: '0.5rem 0.7rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.15rem' }}>{c.title}</p>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: (STATUS_COLORS[c.status] || '#8b949e') + '15', color: STATUS_COLORS[c.status] || '#8b949e' }}>{c.status?.replace(/_/g, ' ')}</span>
                              <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: (SEV_COLORS[c.severity] || '#8b949e') + '15', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                              {c.priority_score > 0 && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>P: {c.priority_score?.toFixed(3)}</span>}
                            </div>
                          </div>
                          <span style={{ color: '#6e7681', fontSize: '0.7rem' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: '#6e7681', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '6px' }}>No complaints assigned to this department.</p>
                  )}
                </div>
              </div>
            ))}
              ))}
            </div>
              </>
            )}
          </div>
        )}
-->
        {/* ===== BUDGET TAB ===== */}
        {activeTab === 'budget' && (
          <div>
            <div style={{ ...cardStyle, marginBottom: '1rem' }}>
              <h3 style={{ color: '#f0f6fc', margin: '0 0 0.5rem' }}>Budget Optimization (0/1 Knapsack)</h3>
              <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 1rem' }}>
                Uses dynamic programming to find the optimal set of complaints to resolve within your budget.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ color: '#c9d1d9', fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Budget Limit (₹)</label>
                  <input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)}
                    style={{ padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.95rem', width: '180px' }} />
                </div>
                <button onClick={runBudgetOptimization} disabled={loading}
                  style={{ padding: '0.65rem 1.5rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                  {loading ? 'Optimizing...' : '🎯 Run Optimization'}
                </button>
              </div>
            </div>

            {budgetResult && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {[
                    { label: 'Budget', value: `₹${(budgetResult.budgetLimit || 0).toLocaleString()}`, color: '#f59e0b' },
                    { label: 'Used', value: `₹${(budgetResult.budgetUsed || 0).toLocaleString()}`, color: '#06b6d4' },
                    { label: 'Utilization', value: `${budgetResult.utilization || 0}%`, color: '#2ea043' },
                    { label: 'Funded', value: budgetResult.itemsIncluded || 0, color: '#a855f7' },
                    { label: 'Excluded', value: budgetResult.itemsExcluded || 0, color: '#f85149' },
                  ].map((stat, i) => (
                    <div key={i} style={{ ...cardStyle, borderLeft: `3px solid ${stat.color}` }}>
                      <p style={{ color: '#8b949e', fontSize: '0.7rem', margin: '0 0 0.2rem' }}>{stat.label}</p>
                      <p style={{ color: stat.color, fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <h3 style={{ color: '#f0f6fc', fontSize: '1rem', marginBottom: '0.75rem' }}>✅ Funded Complaints ({budgetResult.itemsIncluded})</h3>
                {(budgetResult.prioritized || []).map(c => (
                  <div key={c.id} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${SEV_COLORS[c.severity] || '#8b949e'}` }}>
                    <div>
                      <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.2rem', fontWeight: 500 }}>#{c.rank} {c.title}</p>
                      <span style={{ fontSize: '0.7rem', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                      <span style={{ fontSize: '0.7rem', color: '#8b949e', marginLeft: '0.5rem' }}>{c.category?.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>₹{(c.cost || 0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Phone', 'Role', 'Joined', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.75rem', color: '#8b949e', fontSize: '0.8rem', borderBottom: '1px solid rgba(48,54,61,0.5)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(48,54,61,0.3)' }}>
                    <td style={{ padding: '0.75rem', color: '#f0f6fc', fontSize: '0.85rem' }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '0.75rem', color: '#8b949e', fontSize: '0.85rem' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem', color: '#8b949e', fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                        background: u.role === 'admin' ? 'rgba(245,158,11,0.15)' : u.role === 'department_head' ? 'rgba(168,85,247,0.15)' : 'rgba(6,182,212,0.15)',
                        color: u.role === 'admin' ? '#f59e0b' : u.role === 'department_head' ? '#a855f7' : '#06b6d4' }}>{u.role?.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#6e7681', fontSize: '0.8rem' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {/* Only admins can change roles, and can't change their own */}
                      {profile?.role === 'admin' && u.id !== profile?.id && (
                        <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.75rem' }}>
                          <option value="citizen">Citizen</option>
                          <option value="admin">Admin</option>
                          <option value="department_head">Dept Head</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
