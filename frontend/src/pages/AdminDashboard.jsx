import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { complaintsAPI, analyticsAPI, departmentsAPI, adminAPI } from '../services/api';
import { FiBarChart2, FiAlertTriangle, FiUsers, FiDollarSign, FiBriefcase, FiCheck, FiX, FiMessageSquare, FiSend, FiFilter, FiRefreshCw, FiChevronDown, FiChevronUp, FiImage, FiPlus, FiTrash2, FiDownload, FiPhone, FiUserPlus, FiUser, FiMapPin, FiCalendar } from 'react-icons/fi';
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
  const [expandedComplaint, setExpandedComplaint] = useState(null);
  const [recentComplaints, setRecentComplaints] = useState([]);
  // Department sidebar state
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [deptDetailWorkers, setDeptDetailWorkers] = useState([]);
  const [deptDetailComplaints, setDeptDetailComplaints] = useState([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', phone: '', role: 'field_worker' });
  const [assigningComplaint, setAssigningComplaint] = useState(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [complaintWorkerMap, setComplaintWorkerMap] = useState({});
  const [deleteModal, setDeleteModal] = useState(null); // { id, title }
  const [exportLoading, setExportLoading] = useState(false);
  const inputStyle = { width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };

  // Generate hashtag from category/severity/status
  const generateTags = (complaint) => {
    const tags = [];
    if (complaint.category) tags.push(`#${complaint.category.replace(/_/g, '_')}`);
    if (complaint.severity) tags.push(`#${complaint.severity}`);
    if (complaint.departments?.code) tags.push(`#${complaint.departments.code}`);
    if (complaint.ai_detected_labels?.length > 0) {
      complaint.ai_detected_labels.forEach(l => tags.push(`#${l.replace(/\s+/g, '_')}`));
    }
    return [...new Set(tags)];
  };



  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [ov, tr, dp, rc] = await Promise.all([
          analyticsAPI.getOverview().catch(() => ({ data: {} })),
          analyticsAPI.getTrends(30).catch(() => ({ data: { trends: [] } })),
          departmentsAPI.getPerformance().catch(() => ({ data: { performance: [] } })),
          complaintsAPI.getAll({ limit: 10, sort_by: 'created_at', order: 'desc' }).catch(() => ({ data: { complaints: [] } }))
        ]);
        setOverview(ov.data);
        setTrends(tr.data.trends || []);
        setDeptPerformance(dp.data.performance || []);
        setRecentComplaints(rc.data.complaints || []);
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
        // Workers and complaints loaded on-demand when a department is selected (via selectDeptDetail)
        // No upfront loading needed - this prevents the slow N+1 query problem
      } else if (activeTab === 'users') {
        const [uRes, dRes] = await Promise.all([
          adminAPI.getUsers(),
          departmentsAPI.getAll()
        ]);
        setUsers(uRes.data.users || []);
        setDepartments(dRes.data.departments || dRes.data || []);
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

  const handleRoleChange = async (userId, role, departmentId = null) => {
    if (!confirm(`Change this user's role to ${role}?`)) return;
    try {
      const data = { role };
      if (departmentId) data.department_id = departmentId;
      await adminAPI.updateUserRole(userId, data);
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

  const handleDeleteComplaint = async (id) => {
    try {
      await complaintsAPI.delete(id);
      setDeleteModal(null);
      setComplaints(prev => prev.filter(c => c.id !== id));
      setRecentComplaints(prev => prev.filter(c => c.id !== id));
    } catch (err) { alert(err.response?.data?.error || 'Delete failed'); }
  };

  const handleExport = async (format = 'csv', extraParams = {}) => {
    setExportLoading(true);
    try {
      const params = { format, ...extraParams };
      if (filter.status) params.status = filter.status;
      if (filter.severity) params.severity = filter.severity;
      const res = await adminAPI.exportComplaints(params);
      const blob = new Blob([res.data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `civicpulse-complaints.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + (err.response?.data?.error || err.message)); }
    setExportLoading(false);
  };

  const loadComplaintUpdates = async (id) => {
    try {
      const res = await complaintsAPI.getById(id);
      setComplaintUpdates(prev => ({ ...prev, [id]: res.data.complaint?.complaint_updates || [] }));
    } catch (err) { console.error(err); }
  };

  // ===== DEPARTMENT SIDEBAR HELPERS =====
  const selectDeptDetail = async (dept) => {
    setSelectedDept(dept.id);
    setShowAddWorker(false);
    setAssigningComplaint(null);
    try {
      // Fetch full department details first
      const detailRes = await departmentsAPI.getById(dept.id).catch(() => ({ data: { department: dept } }));
      const fullDept = detailRes.data?.department || detailRes.data || dept;
      setDeptDetail(fullDept);

      const [wRes, cRes] = await Promise.all([
        departmentsAPI.getWorkers(dept.id).catch(() => ({ data: { workers: [] } })),
        complaintsAPI.getAll({ department_id: dept.id, limit: 30 }).catch(() => ({ data: { complaints: [] } }))
      ]);
      const workers = wRes.data.workers || [];
      const comps = cRes.data.complaints || [];
      setDeptDetailWorkers(workers);
      setDeptDetailComplaints(comps);

      // Also update sidebar maps so worker counts show
      setDeptWorkers(prev => ({ ...prev, [dept.id]: workers }));
      setDeptComplaints(prev => ({ ...prev, [dept.id]: comps }));

      // Load workers per complaint (in parallel, don't block)
      const cwMap = {};
      await Promise.all(comps.map(async (c) => {
        try { const r = await departmentsAPI.getComplaintWorkers(dept.id, c.id); cwMap[c.id] = r.data.workers || []; }
        catch { cwMap[c.id] = []; }
      }));
      setComplaintWorkerMap(cwMap);
    } catch (err) { console.error('selectDeptDetail error:', err); }
  };

  const addWorkerToDept = async (e) => {
    e.preventDefault();
    if (!selectedDept || !newWorker.name) return;
    try {
      await departmentsAPI.addWorker(selectedDept, newWorker);
      setNewWorker({ name: '', phone: '', role: 'field_worker' });
      setShowAddWorker(false);
      selectDeptDetail({ id: selectedDept, ...deptDetail });
    } catch (err) { alert(err.response?.data?.error || 'Failed to add worker'); }
  };

  const deleteWorkerFromDept = async (workerId) => {
    if (!confirm('Remove this worker?')) return;
    try {
      await departmentsAPI.deleteWorker(workerId);
      selectDeptDetail({ id: selectedDept, ...deptDetail });
    } catch (err) { alert('Remove failed'); }
  };

  const handleAssignWorkers = async (complaintId) => {
    if (selectedWorkerIds.length === 0) return alert('Select at least one worker');
    try {
      await departmentsAPI.assignWorkers(selectedDept, complaintId, { worker_ids: selectedWorkerIds });
      setAssigningComplaint(null);
      setSelectedWorkerIds([]);
      selectDeptDetail({ id: selectedDept, ...deptDetail });
    } catch (err) { alert(err.response?.data?.error || 'Assignment failed'); }
  };

  const toggleWorkerSelection = (wId) => {
    setSelectedWorkerIds(prev => prev.includes(wId) ? prev.filter(id => id !== wId) : [...prev, wId]);
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
    <>
    <div style={{ minHeight: '100vh', padding: '5rem 1rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#f0f6fc', fontSize: '1.75rem', marginBottom: '0.25rem' }}>Admin Command Center</h1>
        <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>Welcome, {profile?.full_name || 'Admin'}</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(22, 27, 34, 0.9)', borderRadius: '12px', padding: '4px', marginBottom: '1.5rem', overflowX: 'auto', border: '1px solid rgba(48, 54, 61, 0.5)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap',
                background: activeTab === tab.id ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                color: activeTab === tab.id ? '#06b6d4' : '#8b949e' }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <FiRefreshCw style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} size={28} color="#06b6d4" />
            <p style={{ color: '#8b949e', fontSize: '0.9rem', margin: 0 }}>Loading...</p>
          </div>
        )}

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
                  <p style={{ color: '#8b949e', fontSize: '0.8125rem', margin: '0 0 0.25rem' }}>{stat.label}</p>
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

            {/* Recent Complaints with Images — integrated from /my-dashboard */}
            {recentComplaints.length > 0 && (
              <div style={{ ...cardStyle, marginTop: '1.5rem' }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 1rem', fontSize: '0.95rem' }}>📋 Recent Complaints</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentComplaints.map(c => (
                    <div key={c.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.3)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', cursor: 'pointer', alignItems: 'center' }}
                        onClick={() => setExpandedComplaint(expandedComplaint === c.id ? null : c.id)}>
                        {/* Image thumbnail */}
                        {c.image_urls?.length > 0 ? (
                          <img src={c.image_urls[0]} alt="" style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(48,54,61,0.5)' }} />
                        ) : (
                          <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: 'rgba(48,54,61,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FiImage color="#6e7681" size={20} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.2rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</p>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: (STATUS_COLORS[c.status] || '#8b949e') + '15', color: STATUS_COLORS[c.status] || '#8b949e' }}>{c.status?.replace(/_/g, ' ')}</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: (SEV_COLORS[c.severity] || '#8b949e') + '15', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                            {c.category && <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{c.category?.replace(/_/g, ' ')}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          <span style={{ color: '#6e7681', fontSize: '0.8125rem' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                          {expandedComplaint === c.id ? <FiChevronUp color="#8b949e" /> : <FiChevronDown color="#8b949e" />}
                        </div>
                      </div>
                      {/* Expanded details */}
                      {expandedComplaint === c.id && (
                        <div style={{ padding: '0 0.75rem 0.75rem', borderTop: '1px solid rgba(48,54,61,0.3)' }}>
                          <p style={{ color: '#c9d1d9', fontSize: '0.8rem', margin: '0.5rem 0' }}>{c.description}</p>
                          {c.image_urls?.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', margin: '0.5rem 0' }}>
                              {c.image_urls.map((url, i) => (
                                <img key={i} src={url} alt="" style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(48,54,61,0.5)', cursor: 'pointer' }}
                                  onClick={() => window.open(url, '_blank')} />
                              ))}
                            </div>
                          )}
                          {c.address && <p style={{ color: '#8b949e', fontSize: '0.8125rem', margin: '0.3rem 0' }}>📍 {c.address}</p>}
                          {c.departments?.name && <p style={{ color: '#06b6d4', fontSize: '0.8125rem', margin: '0.3rem 0' }}>→ {c.departments.name}</p>}
                          {c.priority_score > 0 && <p style={{ color: '#a855f7', fontSize: '0.8125rem', margin: '0.3rem 0' }}>Priority: {(c.priority_score * 100).toFixed(0)}%</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>        {/* ===== DISASTER RESPONSE TAB ===== */}
        {activeTab === 'disaster' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ color: '#f85149', margin: 0, fontSize: '1.375rem', fontWeight: 800 }}>🚨 DISASTER RESPONSE CENTER</h2>
              <button onClick={loadData} style={{ padding: '0.625rem 1.25rem', borderRadius: '10px', border: 'none', background: 'rgba(248,81,73,0.15)', color: '#f85149', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
                <FiRefreshCw size={16} /> Refresh Alerts
              </button>
            </div>

            {disasterAlerts?.autoEscalated > 0 && (
              <div style={{ ...cardStyle, background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)', marginBottom: '1.5rem', padding: '1.25rem' }}>
                <p style={{ color: '#f85149', fontWeight: 800, fontSize: '1.0625rem', margin: '0 0 0.375rem' }}>⚡ EMERGENCY: {disasterAlerts.autoEscalated} complaints auto-escalated!</p>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>System automatically escalated critical issues past their response deadline.</p>
              </div>
            )}

            {/* Escalated Complaints */}
            <h3 style={{ color: '#f85149', fontSize: '1.125rem', margin: '1.5rem 0 0.75rem', fontWeight: 800 }}>🔴 ESCALATED COMPLAINTS ({disasterAlerts?.escalatedComplaints?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(disasterAlerts?.escalatedComplaints || []).map(c => (
                <div key={c.id} style={{ ...cardStyle, borderLeft: '4px solid #f85149', background: 'rgba(248,81,73,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ color: '#f0f6fc', margin: '0 0 0.375rem', fontSize: '1.0625rem', fontWeight: 700 }}>{c.title}</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.9375rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{c.description?.slice(0, 180)}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: '#f8514922', color: '#f85149', fontWeight: 800, textTransform: 'uppercase' }}>ESCALATED</span>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '15', color: SEV_COLORS[c.severity], fontWeight: 800, textTransform: 'uppercase' }}>{c.severity}</span>
                        {c.departments?.name && <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 700 }}>🏢 {c.departments.name}</span>}
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700 }}>🔥 Priority: {c.priority_score?.toFixed(3)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select onChange={(e) => { if (e.target.value) handleStatusUpdate(c.id, e.target.value); e.target.value = ''; }}
                        defaultValue="" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.6)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                        <option value="" disabled>Actions...</option>
                        <option value="assigned">Assign Dept</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolve Now</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {(disasterAlerts?.escalatedComplaints || []).length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem 1rem' }}>
                <p style={{ color: '#2ea043', fontSize: '1.125rem', fontWeight: 700 }}>✅ No escalated complaints. All clear!</p>
              </div>
            )}

            {/* At-Risk Complaints */}
            <h3 style={{ color: '#f59e0b', fontSize: '1.125rem', margin: '2rem 0 0.75rem', fontWeight: 800 }}>⚠️ AT-RISK COMPLAINTS ({disasterAlerts?.atRiskComplaints?.length || 0})</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.875rem', fontWeight: 500 }}>High-severity issues past deadline — system will auto-escalate soon.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(disasterAlerts?.atRiskComplaints || []).map((c, i) => (
                <div key={i} style={{ ...cardStyle, borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h4 style={{ color: '#f0f6fc', margin: '0 0 0.375rem', fontSize: '1.0625rem', fontWeight: 700 }}>{c.title}</h4>
                      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '15', color: SEV_COLORS[c.severity], fontWeight: 800 }}>{c.severity}</span>
                        <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>{c.hoursOverdue}HRS OVERDUE</span>
                      </div>
                    </div>
                    <button onClick={async () => { await adminAPI.escalateComplaint(c.id); loadData(); }}
                      style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: 'rgba(248,81,73,0.15)', color: '#f85149', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 800 }}>
                      🚨 Escalate Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== COMPLAINTS TAB ===== */}
        {activeTab === 'complaints' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{ display: 'flex', gap: '0.875rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <FiFilter color="#64748b" size={18} />
              <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
                style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1px solid rgba(51,65,85,0.6)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 600 }}>
                <option value="">All Statuses</option>
                {Object.keys(STATUS_COLORS).map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
                style={{ padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1px solid rgba(51,65,85,0.6)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 600 }}>
                <option value="">All Severities</option>
                {['low', 'medium', 'high', 'critical'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={loadData} style={{ padding: '0.625rem 1rem', borderRadius: '10px', border: 'none', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>
                <FiRefreshCw size={16} /> Refresh
              </button>
              <span style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 600, marginRight: 'auto' }}>({complaints.length} results)</span>
plaints.length} results)</span>
              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={() => handleExport('csv')} disabled={exportLoading}
                  style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(34,197,94,0.2)' }}>
                  <FiDownload size={13} /> {exportLoading ? '...' : 'CSV'}
                </button>
                <button onClick={() => handleExport('json')} disabled={exportLoading}
                  style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', background: 'rgba(168,85,247,0.12)', color: '#a855f7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, border: '1px solid rgba(168,85,247,0.2)' }}>
                  <FiDownload size={13} /> {exportLoading ? '...' : 'JSON'}
                </button>
              </div>
            </div>

            {complaints.map(c => (
              <div key={c.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  {/* Image thumbnail */}
                  {c.image_urls?.length > 0 ? (
                    <img src={c.image_urls[0]} alt="" style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(48,54,61,0.5)' }} />
                  ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: 'rgba(48,54,61,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiImage color="#6e7681" size={22} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '1rem' }}>{c.title}</h3>
                        <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>{c.description?.slice(0, 120)}{c.description?.length > 120 ? '...' : ''}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.8125rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: (STATUS_COLORS[c.status] || '#8b949e') + '20', color: STATUS_COLORS[c.status] || '#8b949e', fontWeight: 600 }}>{c.status?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: '0.8125rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: (SEV_COLORS[c.severity] || '#8b949e') + '20', color: SEV_COLORS[c.severity] || '#8b949e', fontWeight: 600 }}>{c.severity}</span>
                          <span style={{ fontSize: '0.8125rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(139,148,158,0.1)', color: '#c9d1d9', fontWeight: 500 }}>{c.category?.replace(/_/g, ' ')}</span>
                          {c.departments?.name && <span style={{ fontSize: '0.8125rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 500 }}>{c.departments.name}</span>}
                          {c.priority_score > 0 && <span style={{ fontSize: '0.8125rem', padding: '0.2rem 0.6rem', borderRadius: '6px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 500 }}>Score: {c.priority_score?.toFixed(3)}</span>}
                        </div>
                        {/* Unified ID Tag */}
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(6,182,212,0.12)', color: '#22d3ee', fontWeight: 600, border: '1px solid rgba(6,182,212,0.2)' }}>
                            #{c.id?.split('-')[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {c.status === 'pending_verification' && (
                          <>
                            <button onClick={() => handleVerify(c.id)} style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(46,160,67,0.2)', color: '#2ea043', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <FiCheck size={13} /> Verify
                            </button>
                            <button onClick={() => handleReject(c.id)} style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(248,81,73,0.2)', color: '#f85149', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <FiX size={13} /> Reject
                            </button>
                          </>
                        )}
                        {!['resolved', 'rejected', 'duplicate', 'pending_verification'].includes(c.status) && (
                          <select onChange={(e) => { if (e.target.value) handleStatusUpdate(c.id, e.target.value); e.target.value = ''; }}
                            defaultValue="" style={{ padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.75rem', cursor: 'pointer' }}>
                            <option value="" disabled>Change status...</option>
                            <option value="under_review">Under Review</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="pending_verification">Pending Verification</option>
                            <option value="resolved">Resolve (Admin Only)</option>
                          </select>
                        )}
                        <button onClick={() => { setSelectedComplaintMsg(selectedComplaintMsg === c.id ? null : c.id); loadComplaintUpdates(c.id); }}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(168,85,247,0.2)', color: '#a855f7', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiMessageSquare size={13} /> Messages
                        </button>
                        <button onClick={() => setExpandedComplaint(expandedComplaint === c.id ? null : c.id)}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: 'none', background: 'rgba(6,182,212,0.15)', color: '#06b6d4', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {expandedComplaint === c.id ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />} Details
                        </button>
                        <button onClick={() => setDeleteModal({ id: c.id, title: c.title })}
                          style={{ padding: '0.4rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <FiTrash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details with Photos + Full Timeline */}
                {expandedComplaint === c.id && (() => { if (!complaintUpdates[c.id]) loadComplaintUpdates(c.id); return true; })() && (
                  <div style={{ marginTop: '0.75rem', padding: '1rem', borderTop: '1px solid rgba(48,54,61,0.5)', background: 'rgba(0,0,0,0.1)', borderRadius: '0 0 8px 8px' }}>
                    <p style={{ color: '#c9d1d9', fontSize: '0.9rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{c.description}</p>
                    {c.image_urls?.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 0.4rem', fontWeight: 600 }}>📷 Attached Images ({c.image_urls.length})</p>
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.3rem' }}>
                          {c.image_urls.map((url, i) => (
                            <img key={i} src={url} alt="" style={{ width: '140px', height: '140px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(48,54,61,0.5)', cursor: 'pointer', transition: 'transform 0.2s' }}
                              onClick={() => window.open(url, '_blank')} onMouseOver={e => e.target.style.transform = 'scale(1.05)'} onMouseOut={e => e.target.style.transform = 'scale(1)'} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {c.address && <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>📍 {c.address}</p>}
                      {c.departments?.name && <p style={{ color: '#06b6d4', fontSize: '0.8rem', margin: 0 }}>🏢 {c.departments.name}</p>}
                      {c.priority_score > 0 && <p style={{ color: '#a855f7', fontSize: '0.8rem', margin: 0 }}>📊 Priority: {(c.priority_score * 100).toFixed(0)}%</p>}
                      <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>📅 {new Date(c.created_at).toLocaleString()}</p>
                    </div>
                    {c.ai_detected_labels?.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <p style={{ color: '#06b6d4', fontSize: '0.8rem', margin: '0 0 0.3rem', fontWeight: 600 }}>AI Detected Labels</p>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {c.ai_detected_labels.map((l, i) => (
                            <span key={i} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{l.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full Status Timeline */}
                    <div style={{ borderTop: '1px solid rgba(48,54,61,0.3)', paddingTop: '0.75rem' }}>
                      <p style={{ color: '#f0f6fc', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem' }}>📜 Status Timeline</p>
                      {(complaintUpdates[c.id] || []).length > 0 ? (
                        <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {(complaintUpdates[c.id] || []).map((upd, i) => (
                            <div key={i} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', borderLeft: `3px solid ${upd.comment?.startsWith('[ADMIN MESSAGE]') ? '#a855f7' : upd.new_status ? '#06b6d4' : '#48535f'}`, background: upd.comment?.startsWith('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.06)' : 'rgba(0,0,0,0.15)' }}>
                              <p style={{ color: '#c9d1d9', fontSize: '0.85rem', margin: '0 0 0.2rem' }}>{upd.comment}</p>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ color: '#6e7681', fontSize: '0.75rem' }}>{upd.profiles?.full_name || 'System'}</span>
                                <span style={{ color: '#6e7681', fontSize: '0.75rem' }}>• {new Date(upd.created_at).toLocaleString()}</span>
                                {upd.old_status && upd.new_status && (
                                  <span style={{ fontSize: '0.8125rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>
                                    {upd.old_status.replace(/_/g, ' ')} → {upd.new_status.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ color: '#6e7681', fontSize: '0.8rem', fontStyle: 'italic' }}>No status updates recorded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Messages Panel */}
                {selectedComplaintMsg === c.id && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderTop: '1px solid rgba(48,54,61,0.5)', background: 'rgba(0,0,0,0.15)', borderRadius: '0 0 8px 8px' }}>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                      {(complaintUpdates[c.id] || []).map((upd, i) => (
                        <div key={i} style={{ padding: '0.4rem 0.6rem', marginBottom: '0.3rem', borderRadius: '6px', background: upd.comment?.startsWith('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.08)' : 'rgba(0,0,0,0.15)', borderLeft: `2px solid ${upd.comment?.startsWith('[ADMIN MESSAGE]') ? '#a855f7' : '#48535f'}` }}>
                          <p style={{ color: '#c9d1d9', fontSize: '0.8rem', margin: 0 }}>{upd.comment}</p>
                          <p style={{ color: '#6e7681', fontSize: '0.8rem', margin: '0.15rem 0 0' }}>
                            {upd.profiles?.full_name || 'System'} • {new Date(upd.created_at).toLocaleString()}
                            {upd.old_status && upd.new_status && ` • ${upd.old_status} → ${upd.new_status}`}
                          </p>
                        </div>
                      ))}
                      {(!complaintUpdates[c.id] || complaintUpdates[c.id].length === 0) && (
                        <p style={{ color: '#6e7681', fontSize: '0.8rem', margin: 0 }}>No messages yet</p>
                      )}
                    </div>
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

        {/* ===== DEPARTMENTS TAB (SIDEBAR + DETAIL) ===== */}
        {activeTab === 'departments' && !loading && (
          <div>
            {/* Performance Chart */}
            {deptPerformance.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Department Performance</h3>
                <div style={{ height: '250px' }}><Bar data={deptChartData} options={CHART_OPTS} /></div>
              </div>
            )}

            {departments.length === 0 && (
              <p style={{ color: '#8b949e', textAlign: 'center', padding: '2rem' }}>No departments found.</p>
            )}

            {/* Sidebar + Detail Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: departments.length > 0 ? '240px 1fr' : '1fr', gap: '1.25rem' }}>
              {/* LEFT — Department List */}
              <div>
                <h3 style={{ color: '#c9d1d9', fontSize: '1.125rem', margin: '0 0 0.75rem', fontWeight: 800 }}>DEPARTMENTS ({departments.length})</h3>
                {departments.map(dept => (
                  <div key={dept.id} onClick={() => selectDeptDetail(dept)}
                    style={{ ...cardStyle, marginBottom: '0.625rem', cursor: 'pointer', padding: '1rem',
                      borderLeft: `4px solid ${selectedDept === dept.id ? '#06b6d4' : 'transparent'}`,
                      background: selectedDept === dept.id ? 'rgba(6,182,212,0.1)' : cardStyle.background, transition: 'all 0.2s' }}>
                    <h4 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '1.0625rem', fontWeight: 700 }}>{dept.name}</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#06b6d4', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.5px' }}>{dept.code}</span>
                      <span style={{ fontSize: '0.875rem', color: '#8b949e', fontWeight: 600 }}>{dept.workerCount || 0} workers</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* RIGHT — Detail Panel */}
              {selectedDept && deptDetail ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h2 style={{ color: '#f0f6fc', fontSize: '1.25rem', margin: '0 0 0.15rem' }}>{deptDetail.name}</h2>
                      <span style={{ color: '#06b6d4', fontSize: '0.8rem' }}>{deptDetail.code}</span>
                    </div>
                    <span style={{ fontSize: '0.8125rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                      background: deptDetail.is_active ? 'rgba(46,160,67,0.15)' : 'rgba(248,81,73,0.15)',
                      color: deptDetail.is_active ? '#2ea043' : '#f85149' }}>{deptDetail.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                    {[{ v: deptDetailWorkers.length, l: 'Workers', c: '#06b6d4' }, { v: deptDetailComplaints.length, l: 'Complaints', c: '#a855f7' }, { v: deptDetail.completionRate || 0, l: 'Complete %', c: '#2ea043' }].map((s, i) => (
                      <div key={i} style={{ ...cardStyle, textAlign: 'center', padding: '0.6rem' }}>
                        <p style={{ color: s.c, fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{s.v}</p>
                        <p style={{ color: '#6e7681', fontSize: '0.75rem', margin: 0 }}>{s.l}</p>
                      </div>
                    ))}
                  </div>
                  {deptDetail.head_name && (
                    <div style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: '3px solid #f59e0b', padding: '0.6rem 0.9rem' }}>
                      <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: '0 0 0.15rem', fontWeight: 600 }}>👤 Dept Head</p>
                      <p style={{ color: '#c9d1d9', fontSize: '0.95rem', margin: 0 }}>{deptDetail.head_name}</p>
                      {deptDetail.head_email && <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0.1rem 0 0' }}>📧 {deptDetail.head_email}</p>}
                    </div>
                  )}
                  {/* Workers */}
                  <div style={{ ...cardStyle, marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <h4 style={{ color: '#06b6d4', fontSize: '1rem', margin: 0 }}>👷 Workers ({deptDetailWorkers.length})</h4>
                      <button onClick={() => setShowAddWorker(!showAddWorker)} style={{ padding: '0.35rem 0.7rem', borderRadius: '5px', border: 'none', background: 'rgba(46,160,67,0.2)', color: '#2ea043', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiPlus size={13} /> Add</button>
                    </div>
                    {showAddWorker && (
                      <form onSubmit={addWorkerToDept} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', marginBottom: '0.3rem' }}>
                          <input placeholder="Name" value={newWorker.name} onChange={e => setNewWorker(w => ({ ...w, name: e.target.value }))} required style={inputStyle} />
                          <input placeholder="Phone" value={newWorker.phone} onChange={e => setNewWorker(w => ({ ...w, phone: e.target.value }))} style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <select value={newWorker.role} onChange={e => setNewWorker(w => ({ ...w, role: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                            <option value="field_worker">Field Worker</option><option value="supervisor">Supervisor</option><option value="inspector">Inspector</option><option value="technician">Technician</option>
                          </select>
                          <button type="submit" style={{ padding: '0.35rem 0.7rem', borderRadius: '5px', border: 'none', background: '#2ea043', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}>Add</button>
                        </div>
                      </form>
                    )}
                    {deptDetailWorkers.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
                        {deptDetailWorkers.map(w => (
                          <div key={w.id} style={{ padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ color: '#f0f6fc', fontSize: '0.9rem', margin: '0 0 0.15rem', fontWeight: 500 }}>{w.name}</p><span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{w.role?.replace(/_/g, ' ')} • {w.phone || 'N/A'}</span></div>
                            <button onClick={() => deleteWorkerFromDept(w.id)} style={{ padding: '0.25rem', borderRadius: '4px', border: 'none', background: 'rgba(248,81,73,0.1)', color: '#f85149', cursor: 'pointer' }}><FiTrash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ color: '#6e7681', fontSize: '0.85rem' }}>No workers yet.</p>}
                  </div>
                  {/* Complaints */}
                  <div style={{ ...cardStyle }}>
                    <h4 style={{ color: '#a855f7', fontSize: '1rem', margin: '0 0 0.5rem' }}>📋 Complaints ({deptDetailComplaints.length})</h4>
                    {deptDetailComplaints.map(c => (
                      <div key={c.id} style={{ padding: '0.6rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: '#f0f6fc', fontSize: '0.9rem', margin: '0 0 0.15rem' }}>{c.title}</p>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.8125rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: (STATUS_COLORS[c.status] || '#8b949e') + '15', color: STATUS_COLORS[c.status] || '#8b949e' }}>{c.status?.replace(/_/g, ' ')}</span>
                              <span style={{ fontSize: '0.8125rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: (SEV_COLORS[c.severity] || '#8b949e') + '15', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                              {(complaintWorkerMap[c.id] || []).length > 0 && <span style={{ fontSize: '0.8125rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(46,160,67,0.1)', color: '#2ea043' }}>{(complaintWorkerMap[c.id] || []).length} workers</span>}
                            </div>
                          </div>
                          <button onClick={() => { setAssigningComplaint(assigningComplaint === c.id ? null : c.id); setSelectedWorkerIds((complaintWorkerMap[c.id] || []).map(w => w.id)); }}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '5px', border: 'none', background: 'rgba(46,160,67,0.15)', color: '#2ea043', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FiUserPlus size={12} /> Assign</button>
                        </div>
                        {assigningComplaint === c.id && deptDetailWorkers.length > 0 && (
                          <div style={{ marginTop: '0.3rem', padding: '0.4rem', background: 'rgba(0,0,0,0.15)', borderRadius: '5px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
                              {deptDetailWorkers.map(w => (
                                <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.4rem', borderRadius: '4px', cursor: 'pointer', background: selectedWorkerIds.includes(w.id) ? 'rgba(46,160,67,0.08)' : 'transparent' }}>
                                  <input type="checkbox" checked={selectedWorkerIds.includes(w.id)} onChange={() => toggleWorkerSelection(w.id)} style={{ accentColor: '#2ea043', width: '16px', height: '16px' }} />
                                  <span style={{ color: '#f0f6fc', fontSize: '0.85rem' }}>{w.name}</span>
                                  <span style={{ color: '#8b949e', fontSize: '0.8125rem' }}>{w.role?.replace(/_/g, ' ')}</span>
                                </label>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button onClick={() => handleAssignWorkers(c.id)} style={{ padding: '0.35rem 0.7rem', borderRadius: '5px', border: 'none', background: '#2ea043', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Assign {selectedWorkerIds.length}</button>
                              <button onClick={() => { setAssigningComplaint(null); setSelectedWorkerIds([]); }} style={{ padding: '0.35rem 0.7rem', borderRadius: '5px', border: '1px solid rgba(48,54,61,0.8)', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {deptDetailComplaints.length === 0 && <p style={{ color: '#6e7681', fontSize: '0.85rem' }}>No complaints assigned.</p>}
                  </div>
                </div>
              ) : departments.length > 0 ? (
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                  <p style={{ color: '#8b949e', fontSize: '0.9rem' }}>← Select a department to view details</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
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
                      <p style={{ color: '#8b949e', fontSize: '0.8125rem', margin: '0 0 0.2rem' }}>{stat.label}</p>
                      <p style={{ color: stat.color, fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <h3 style={{ color: '#f0f6fc', fontSize: '1rem', marginBottom: '0.75rem' }}>✅ Funded Complaints ({budgetResult.itemsIncluded})</h3>
                {(budgetResult.prioritized || []).map(c => (
                  <div key={c.id} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${SEV_COLORS[c.severity] || '#8b949e'}` }}>
                    <div>
                      <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.2rem', fontWeight: 500 }}>#{c.rank} {c.title}</p>
                      <span style={{ fontSize: '0.8125rem', color: SEV_COLORS[c.severity] || '#8b949e' }}>{c.severity}</span>
                      <span style={{ fontSize: '0.8125rem', color: '#8b949e', marginLeft: '0.5rem' }}>{c.category?.replace(/_/g, ' ')}</span>
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

        {/* ===== USERS TAB (with Dept Head Approval) ===== */}
        {activeTab === 'users' && (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            {/* Pending Dept Head Approvals */}
            {users.filter(u => u.role === 'pending_dept_head').length > 0 && (
              <div style={{ ...cardStyle, marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.06)' }}>
                <h3 style={{ color: '#f59e0b', margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  ⏳ PENDING APPROVALS ({users.filter(u => u.role === 'pending_dept_head').length})
                </h3>
                {users.filter(u => u.role === 'pending_dept_head').map(u => (
                  <div key={u.id} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', marginBottom: '0.625rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div>
                      <p style={{ color: '#f0f6fc', fontSize: '1.0625rem', margin: '0 0 0.375rem', fontWeight: 700 }}>{u.full_name || 'Unknown User'}</p>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: 500 }}>{u.email}</span>
                        {u.phone && <span style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><FiPhone size={14} /> {u.phone}</span>}
                        {u.departments && <span style={{ fontSize: '0.875rem', color: '#a855f7', fontWeight: 700, background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: '4px' }}>🏢 {u.departments.name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                      <button onClick={() => handleRoleChange(u.id, 'department_head', u.department_id)}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 4px 12px rgba(34,197,94,0.2)' }}>
                        ✓ Approve Head
                      </button>
                      <button onClick={() => handleRoleChange(u.id, 'citizen')}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700 }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All Users Table */}
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#f0f6fc', fontSize: '1.125rem', fontWeight: 800, margin: 0 }}>USER DIRECTORY ({users.length})</h3>
                <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Global Access Control</span>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                  <thead>
                    <tr>
                      {['User Info', 'Contact', 'Role & Assignment', 'Joined', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1rem', color: '#94a3b8', fontSize: '0.8125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ background: 'rgba(255,255,255,0.02)', transition: 'transform 0.2s, background 0.2s' }}>
                        <td style={{ padding: '1rem', borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #334155, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', fontWeight: 700, fontSize: '1.125rem', border: '1px solid rgba(56,189,248,0.2)' }}>
                              {(u.full_name || 'U').charAt(0)}
                            </div>
                            <div>
                              <p style={{ color: '#f0f6fc', fontSize: '1rem', margin: '0 0 0.125rem', fontWeight: 700 }}>{u.full_name || '—'}</p>
                              <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0, fontWeight: 500 }}>UID: {u.id.slice(0,8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <p style={{ color: '#cbd5e1', fontSize: '0.9375rem', margin: '0 0 0.25rem', fontWeight: 600 }}>{u.email}</p>
                          <p style={{ color: '#64748b', fontSize: '0.8125rem', margin: 0, fontWeight: 500 }}>{u.phone || 'No Phone Registered'}</p>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <span style={{ alignSelf: 'flex-start', fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', fontWeight: 800, textTransform: 'uppercase',
                              background: u.role === 'admin' ? 'rgba(245,158,11,0.12)' : u.role === 'department_head' ? 'rgba(168,85,247,0.12)' : 'rgba(56,189,248,0.12)',
                              color: u.role === 'admin' ? '#f59e0b' : u.role === 'department_head' ? '#a855f7' : '#38bdf8' }}>
                              {u.role?.replace(/_/g, ' ')}
                            </span>
                            {u.departments && (
                              <span style={{ fontSize: '0.8125rem', color: '#a855f7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <FiBriefcase size={12} /> {u.departments.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem', fontWeight: 600 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                        <td style={{ padding: '1rem', borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>
                          {profile?.role === 'admin' && u.id !== profile?.id && u.role !== 'pending_dept_head' && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'row', alignItems: 'center' }}>
                              <select 
                                value={u.role} 
                                onChange={e => handleRoleChange(u.id, e.target.value, u.department_id)}
                                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.6)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}>
                                <option value="citizen">Citizen</option>
                                <option value="admin">Admin</option>
                                <option value="department_head">Dept Head</option>
                              </select>
                              
                              <select 
                                value={u.department_id || ''} 
                                onChange={e => handleRoleChange(u.id, u.role, e.target.value)}
                                style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: `1px solid ${u.department_id ? 'rgba(168,85,247,0.4)' : 'rgba(51,65,85,0.6)'}`, 
                                  background: u.department_id ? 'rgba(168,85,247,0.06)' : 'rgba(0,0,0,0.3)', 
                                  color: u.department_id ? '#a855f7' : '#94a3b8', 
                                  fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', maxWidth: '180px' }}>
                                <option value="">No Dept Assigned</option>
                                {departments.map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ===== DELETE CONFIRMATION MODAL ===== */}
    {deleteModal && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.98)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '16px', padding: '2rem', maxWidth: '420px', width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.2s ease-out'
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.5rem' }}>
            🗑️
          </div>
          <h3 style={{ color: '#f0f6fc', fontSize: '1.125rem', fontWeight: 700, textAlign: 'center', margin: '0 0 0.5rem' }}>
            Delete Complaint?
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
            This action <strong style={{ color: '#ef4444' }}>cannot be undone</strong>. All related updates and assignments will also be deleted.
          </p>
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '0.625rem 0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: '#f87171', fontSize: '0.8125rem', fontWeight: 600, margin: 0, fontStyle: 'italic' }}>
              "{deleteModal.title}"
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => setDeleteModal(null)} style={{
              flex: 1, padding: '0.75rem', borderRadius: '10px',
              border: '1px solid rgba(51,65,85,0.6)', background: 'transparent',
              color: '#cbd5e1', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
            }}>
              Cancel
            </button>
            <button onClick={() => handleDeleteComplaint(deleteModal.id)} style={{
              flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 14px rgba(239,68,68,0.3)'
            }}>
              🗑️ Delete Permanently
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
