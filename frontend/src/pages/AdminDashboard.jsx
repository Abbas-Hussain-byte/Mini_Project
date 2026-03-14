import { useState, useEffect, useCallback } from 'react';
import { analyticsAPI, complaintsAPI, departmentsAPI, adminAPI } from '../services/api';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler } from 'chart.js';
import {
  FiAlertTriangle, FiCheckCircle, FiClock, FiTrendingUp, FiLoader,
  FiBarChart2, FiList, FiUsers, FiDollarSign, FiCpu, FiGrid,
  FiMapPin, FiSearch, FiFilter, FiChevronDown, FiChevronUp,
  FiShield, FiTarget, FiLayers, FiZap, FiRefreshCw
} from 'react-icons/fi';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } },
  scales: {
    x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.3)' } },
    y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.3)' } }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } } }
};

const STATUS_BADGES = {
  submitted: 'bg-blue-500/20 text-blue-400',
  under_review: 'bg-indigo-500/20 text-indigo-400',
  assigned: 'bg-purple-500/20 text-purple-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  resolved: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  duplicate: 'bg-slate-500/20 text-slate-400',
};

const SEVERITY_BADGES = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const TABS = [
  { id: 'overview', label: 'Overview', icon: <FiBarChart2 /> },
  { id: 'complaints', label: 'Complaints', icon: <FiList /> },
  { id: 'departments', label: 'Departments', icon: <FiGrid /> },
  { id: 'budget', label: 'Budget', icon: <FiDollarSign /> },
  { id: 'ai', label: 'AI & ML', icon: <FiCpu /> },
  { id: 'users', label: 'Users', icon: <FiUsers /> },
];

// ====================== MAIN COMPONENT ======================
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Overview data
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [responseTimes, setResponseTimes] = useState(null);

  // Complaints data
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedComplaint, setExpandedComplaint] = useState(null);

  // Departments data
  const [departments, setDepartments] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [expandedDept, setExpandedDept] = useState(null);
  const [deptAssignments, setDeptAssignments] = useState({});

  // Budget data
  const [budgetLimit, setBudgetLimit] = useState('');
  const [prioritized, setPrioritized] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // AI/ML data
  const [riskAreas, setRiskAreas] = useState([]);
  const [duplicateInsights, setDuplicateInsights] = useState(null);
  const [heatmapData, setHeatmapData] = useState({ points: [], clusters: [] });

  // Users data
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const [ovRes, trRes, rtRes] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getTrends(30),
        analyticsAPI.getResponseTimes()
      ]);
      setOverview(ovRes.data);
      setTrends(trRes.data.trends || []);
      setResponseTimes(rtRes.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const { data } = await complaintsAPI.getAll({ sort_by: 'created_at', order: 'desc', limit: 100 });
      setComplaints(data.complaints || []);
    } catch (err) { console.error(err); }
    setComplaintsLoading(false);
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const [deptRes, perfRes] = await Promise.all([
        departmentsAPI.getAll(),
        departmentsAPI.getPerformance()
      ]);
      setDepartments(deptRes.data.departments || []);
      setPerformance(perfRes.data.performance || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadAIData = useCallback(async () => {
    try {
      const [riskRes, dupRes, heatRes] = await Promise.all([
        analyticsAPI.getRiskAreas(),
        analyticsAPI.getDuplicates(),
        analyticsAPI.getHeatmap()
      ]);
      setRiskAreas(riskRes.data.riskAreas || riskRes.data.risk_areas || []);
      setDuplicateInsights(dupRes.data);
      setHeatmapData({
        points: heatRes.data.points || [],
        clusters: heatRes.data.clusters || []
      });
    } catch (err) { console.error(err); }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const { data } = await adminAPI.getUsers();
      setUsers(data.users || []);
    } catch (err) { console.error(err); }
    setUsersLoading(false);
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'complaints' && complaints.length === 0) loadComplaints();
    if (activeTab === 'departments' && departments.length === 0) loadDepartments();
    if (activeTab === 'ai' && riskAreas.length === 0) loadAIData();
    if (activeTab === 'users' && users.length === 0) loadUsers();
  }, [activeTab]);

  // =================== ACTIONS ===================
  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      await complaintsAPI.update(complaintId, { status: newStatus });
      setComplaints(complaints.map(c => c.id === complaintId ? { ...c, status: newStatus } : c));
    } catch (err) { console.error(err); }
  };

  const runBudgetPrioritization = async () => {
    if (!budgetLimit) return;
    setBudgetLoading(true);
    try {
      const { data } = await adminAPI.getPriorities({ budget_limit: budgetLimit });
      setPrioritized(data);
    } catch (err) { console.error(err); }
    setBudgetLoading(false);
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) { console.error(err); }
  };

  const toggleDeptExpand = async (deptId) => {
    if (expandedDept === deptId) return setExpandedDept(null);
    setExpandedDept(deptId);
    if (!deptAssignments[deptId]) {
      try {
        const { data } = await departmentsAPI.getAssignments(deptId, { limit: 10 });
        setDeptAssignments({ ...deptAssignments, [deptId]: data.assignments || [] });
      } catch (err) { console.error(err); }
    }
  };

  const updateAssignment = async (assignmentId, status) => {
    try {
      await departmentsAPI.updateAssignment(assignmentId, { status });
      if (expandedDept) {
        const { data } = await departmentsAPI.getAssignments(expandedDept, { limit: 10 });
        setDeptAssignments({ ...deptAssignments, [expandedDept]: data.assignments || [] });
      }
      loadDepartments();
    } catch (err) { console.error(err); }
  };

  // =================== FILTERED COMPLAINTS ===================
  const filteredComplaints = complaints.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
    if (searchQuery && !c.title?.toLowerCase().includes(searchQuery.toLowerCase()) && !c.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen"><FiLoader className="w-8 h-8 text-civic-accent animate-spin" /></div>;

  // =================== CHART DATA ===================
  const categoryData = {
    labels: Object.keys(overview?.byCategory || {}),
    datasets: [{
      data: Object.values(overview?.byCategory || {}),
      backgroundColor: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'],
      borderWidth: 0,
    }]
  };

  const severityData = {
    labels: Object.keys(overview?.bySeverity || {}),
    datasets: [{
      label: 'Count',
      data: Object.values(overview?.bySeverity || {}),
      backgroundColor: ['#22c55e', '#f59e0b', '#f97316', '#ef4444'],
      borderRadius: 8,
      borderWidth: 0,
    }]
  };

  const trendData = {
    labels: trends.map(t => t.date.split('-').slice(1).join('/')),
    datasets: [{
      label: 'Complaints',
      data: trends.map(t => t.count),
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.1)',
      fill: true, tension: 0.4, borderWidth: 2, pointRadius: 3,
    }]
  };

  const statCards = [
    { label: 'Total Complaints', value: overview?.total || 0, icon: <FiAlertTriangle />, color: 'text-civic-accent' },
    { label: 'Resolved', value: overview?.resolved || 0, icon: <FiCheckCircle />, color: 'text-civic-success' },
    { label: 'Resolution Rate', value: `${overview?.resolutionRate || 0}%`, icon: <FiTrendingUp />, color: 'text-primary-400' },
    { label: 'This Week', value: overview?.recentCount || 0, icon: <FiClock />, color: 'text-civic-warning' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm">CivicPulse administration & AI intelligence center</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-civic-accent/20 text-civic-accent border border-civic-accent/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* =================== OVERVIEW TAB =================== */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s, i) => (
              <div key={i} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${s.color} mb-3`}>{s.icon}</div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Complaint Trends (30 days)</h3>
              <div className="h-64"><Line data={trendData} options={chartOptions} /></div>
            </div>
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">By Severity</h3>
              <div className="h-64"><Bar data={severityData} options={chartOptions} /></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">By Category</h3>
              <div className="h-64 flex items-center justify-center"><Doughnut data={categoryData} options={doughnutOptions} /></div>
            </div>
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Response Times</h3>
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Average Resolution</span>
                  <span className="text-2xl font-bold text-civic-accent">{responseTimes?.averageHours || 0}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Total Resolved</span>
                  <span className="text-lg font-semibold text-civic-success">{responseTimes?.totalResolved || 0}</span>
                </div>
                {responseTimes?.bySeverity && Object.entries(responseTimes.bySeverity).map(([sev, data]) => (
                  <div key={sev} className="flex justify-between items-center text-sm">
                    <span className="capitalize text-slate-400">{sev}</span>
                    <span className="text-slate-300">{data.avgHours}h avg ({data.count} resolved)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== COMPLAINTS TAB =================== */}
      {activeTab === 'complaints' && (
        <div className="animate-fade-in">
          {/* Filters */}
          <div className="glass-card p-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-3 text-slate-500" size={16} />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search complaints..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent outline-none text-sm" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white text-sm outline-none focus:border-civic-accent">
                <option value="all">All Status</option>
                {Object.keys(STATUS_BADGES).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white text-sm outline-none focus:border-civic-accent">
                <option value="all">All Severity</option>
                {Object.keys(SEVERITY_BADGES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={loadComplaints} className="p-2.5 rounded-lg bg-civic-accent/10 text-civic-accent hover:bg-civic-accent/20 transition-all">
                <FiRefreshCw size={16} />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-3">{filteredComplaints.length} complaint{filteredComplaints.length !== 1 ? 's' : ''} found</p>

          {complaintsLoading ? (
            <div className="flex items-center justify-center py-20"><FiLoader className="w-6 h-6 text-civic-accent animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {filteredComplaints.map(c => (
                <div key={c.id} className="glass-card overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => setExpandedComplaint(expandedComplaint === c.id ? null : c.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-semibold text-white text-sm">{c.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${SEVERITY_BADGES[c.severity]}`}>{c.severity}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGES[c.status]}`}>{c.status?.replace('_', ' ')}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">{c.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                          <span><FiClock size={11} className="inline mr-1" />{new Date(c.created_at).toLocaleDateString()}</span>
                          {c.category && <span className="capitalize">{c.category.replace('_', ' ')}</span>}
                          {c.departments?.name && <span className="text-civic-accent">→ {c.departments.name}</span>}
                          <span>Score: {(c.priority_score * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status management buttons */}
                        {c.status === 'submitted' && (
                          <button onClick={(e) => { e.stopPropagation(); updateComplaintStatus(c.id, 'under_review'); }}
                            className="px-2 py-1 rounded text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30">Review</button>
                        )}
                        {c.status === 'under_review' && (
                          <button onClick={(e) => { e.stopPropagation(); updateComplaintStatus(c.id, 'assigned'); }}
                            className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">Assign</button>
                        )}
                        {c.status === 'assigned' && (
                          <button onClick={(e) => { e.stopPropagation(); updateComplaintStatus(c.id, 'in_progress'); }}
                            className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Start</button>
                        )}
                        {c.status === 'in_progress' && (
                          <button onClick={(e) => { e.stopPropagation(); updateComplaintStatus(c.id, 'resolved'); }}
                            className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Resolve</button>
                        )}
                        {expandedComplaint === c.id ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                      </div>
                    </div>
                  </div>

                  {expandedComplaint === c.id && (
                    <div className="border-t border-civic-border/50 p-4 animate-slide-up bg-white/[0.02]">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <h5 className="text-xs font-medium text-slate-300 mb-2">AI Analysis</h5>
                          {c.ai_detected_labels?.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {c.ai_detected_labels.map((l, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-civic-accent/10 text-civic-accent text-xs">{l}</span>
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-500">Pending</p>}
                          {c.ai_analysis && Object.keys(c.ai_analysis).length > 0 && (
                            <div className="text-xs text-slate-400 space-y-1 mt-2">
                              {c.ai_analysis.text_category && <p>Category: <span className="text-white">{c.ai_analysis.text_category}</span></p>}
                              {c.ai_analysis.text_severity && <p>AI Severity: <span className="text-white">{c.ai_analysis.text_severity}</span></p>}
                              {c.ai_analysis.hazards_detected && <p>Hazards: <span className="text-white">{c.ai_analysis.hazards_detected.join(', ')}</span></p>}
                              {c.ai_analysis.duplicate_check && <p>Duplicate: <span className="text-white">{c.ai_analysis.duplicate_check.is_duplicate ? 'Yes' : 'No'}</span></p>}
                            </div>
                          )}
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-slate-300 mb-2">Location</h5>
                          <p className="text-xs text-slate-400">{c.address || 'No address'}</p>
                          <p className="text-xs text-slate-500 mt-1">Lat: {c.latitude}, Lng: {c.longitude}</p>
                          <h5 className="text-xs font-medium text-slate-300 mt-3 mb-1">Department</h5>
                          <p className="text-xs text-civic-accent">{c.departments?.name || 'Unassigned'}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-slate-300 mb-2">Images</h5>
                          {c.image_urls?.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto">
                              {c.image_urls.map((url, i) => (
                                <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-civic-border" />
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-500">No images</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================== DEPARTMENTS TAB =================== */}
      {activeTab === 'departments' && (
        <div className="animate-fade-in">
          {/* Performance Summary */}
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {performance.slice(0, 8).map((dept, i) => (
              <div key={i} className="glass-card p-4 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <h4 className="text-sm font-medium text-white truncate">{dept.name}</h4>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-civic-accent">{dept.completionRate}%</span>
                  <span className="text-xs text-slate-500">completion</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>{dept.totalAssignments} total</span>
                  <span className="text-civic-success">{dept.completed} done</span>
                  {dept.overdue > 0 && <span className="text-red-400">{dept.overdue} overdue</span>}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-civic-accent to-primary-500 transition-all" style={{ width: `${dept.completionRate}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Department List with Expandable Assignments */}
          <div className="space-y-3">
            {departments.map(dept => (
              <div key={dept.id} className="glass-card overflow-hidden">
                <div className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => toggleDeptExpand(dept.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-civic-accent/10 flex items-center justify-center">
                        <FiUsers className="w-5 h-5 text-civic-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{dept.name}</h3>
                        <p className="text-xs text-slate-400">{dept.code} • {dept.workerCount} workers • {dept.activeAssignments} active</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white">{dept.completedAssignments}/{dept.totalAssignments}</p>
                        <p className="text-xs text-slate-500">completed</p>
                      </div>
                      {expandedDept === dept.id ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                    </div>
                  </div>
                </div>

                {expandedDept === dept.id && (
                  <div className="border-t border-civic-border/50 p-5 animate-slide-up">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-slate-300">Recent Assignments</h4>
                      <span className="text-xs text-slate-500">Jurisdiction: {dept.jurisdiction_categories?.join(', ')}</span>
                    </div>
                    {(deptAssignments[dept.id] || []).length === 0 ? (
                      <p className="text-sm text-slate-500">No assignments yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(deptAssignments[dept.id] || []).map(a => (
                          <div key={a.id} className="p-3 rounded-lg bg-white/[0.03] flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{a.complaints?.title || 'Complaint'}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{a.assignment_reason}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full ${STATUS_BADGES[a.status] || 'bg-slate-500/20 text-slate-400'}`}>{a.status}</span>
                                {a.isOverdue && <span className="text-red-400 flex items-center gap-1"><FiAlertTriangle size={12} /> Overdue</span>}
                                <span className="text-slate-500"><FiClock size={12} className="inline mr-1" />{new Date(a.assigned_at).toLocaleDateString()}</span>
                                {a.workers_assigned > 0 && <span className="text-slate-400">{a.workers_assigned} workers</span>}
                              </div>
                            </div>
                            {!['completed', 'rejected'].includes(a.status) && (
                              <div className="flex gap-1 shrink-0">
                                {a.status === 'pending' && (
                                  <button onClick={(e) => { e.stopPropagation(); updateAssignment(a.id, 'acknowledged'); }}
                                    className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Ack</button>
                                )}
                                {a.status === 'acknowledged' && (
                                  <button onClick={(e) => { e.stopPropagation(); updateAssignment(a.id, 'in_progress'); }}
                                    className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Start</button>
                                )}
                                {a.status === 'in_progress' && (
                                  <button onClick={(e) => { e.stopPropagation(); updateAssignment(a.id, 'completed'); }}
                                    className="px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Complete</button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================== BUDGET TAB =================== */}
      {activeTab === 'budget' && (
        <div className="animate-fade-in">
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiDollarSign className="text-civic-accent" /> Budget-Aware Prioritization
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Enter a budget limit to see which complaints can be addressed within the budget.
              The system uses AI-computed priority scores and estimated costs per severity level.
            </p>
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-slate-400 mb-1">Budget Limit (₹)</label>
                <input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)}
                  placeholder="e.g., 500000"
                  className="w-full px-4 py-2.5 rounded-lg bg-civic-dark border border-civic-border text-white placeholder:text-slate-500 focus:border-civic-accent outline-none" />
              </div>
              <button onClick={runBudgetPrioritization} disabled={budgetLoading || !budgetLimit}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-civic-accent to-primary-500 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                {budgetLoading ? 'Calculating...' : 'Run Prioritization'}
              </button>
            </div>

            {/* Cost Legend */}
            <div className="mt-4 p-3 rounded-lg bg-white/[0.03]">
              <p className="text-xs text-slate-400 mb-2">Estimated cost per severity:</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-red-400">Critical: ₹50,000</span>
                <span className="text-orange-400">High: ₹30,000</span>
                <span className="text-yellow-400">Medium: ₹15,000</span>
                <span className="text-green-400">Low: ₹5,000</span>
              </div>
            </div>
          </div>

          {prioritized && (
            <div className="animate-slide-up">
              {/* Budget Summary Cards */}
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Budget Limit</p>
                  <p className="text-xl font-bold text-white">₹{Number(prioritized.budgetLimit).toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Budget Used</p>
                  <p className="text-xl font-bold text-civic-accent">₹{Number(prioritized.budgetUsed).toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Items Included</p>
                  <p className="text-xl font-bold text-civic-success">{prioritized.itemsIncluded}</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">Items Excluded</p>
                  <p className="text-xl font-bold text-red-400">{prioritized.itemsExcluded}</p>
                </div>
              </div>

              {/* Budget Usage Bar */}
              <div className="glass-card p-4 mb-6">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Budget Utilization</span>
                  <span>{((prioritized.budgetUsed / prioritized.budgetLimit) * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-civic-accent to-primary-500"
                    style={{ width: `${Math.min((prioritized.budgetUsed / prioritized.budgetLimit) * 100, 100)}%` }} />
                </div>
              </div>

              {/* Prioritized List */}
              <h3 className="text-sm font-medium text-slate-300 mb-3">Priority-Ranked Complaints (within budget)</h3>
              <div className="space-y-2">
                {(prioritized.prioritized || []).map((c, i) => (
                  <div key={c.id} className="glass-card p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-civic-accent/10 flex items-center justify-center text-civic-accent font-bold text-sm shrink-0">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{c.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span className={`px-2 py-0.5 rounded-full ${SEVERITY_BADGES[c.severity]}`}>{c.severity}</span>
                        <span>Score: {(c.priority_score * 100).toFixed(0)}%</span>
                        {c.departments?.name && <span className="text-civic-accent">{c.departments.name}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-white">₹{{ critical: '50,000', high: '30,000', medium: '15,000', low: '5,000' }[c.severity] || '10,000'}</p>
                      <p className="text-xs text-slate-500">est. cost</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================== AI & ML TAB =================== */}
      {activeTab === 'ai' && (
        <div className="animate-fade-in">
          {/* AI Pipeline Overview */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <FiCpu className="text-civic-accent" /> AI/ML Pipeline Status
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { name: 'YOLOv8 Hazard Detection', desc: 'Image hazards (potholes, waterlogging, debris)', icon: <FiTarget />, status: 'Active' },
                { name: 'BERT Text Classifier', desc: 'Category & severity from complaint text', icon: <FiLayers />, status: 'Active' },
                { name: 'CLIP Embeddings', desc: 'Duplicate detection via cosine similarity', icon: <FiShield />, status: 'Active' },
                { name: 'DBSCAN Clustering', desc: 'Geospatial hotspot clustering', icon: <FiMapPin />, status: 'Active' },
              ].map((model, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-civic-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-civic-accent">{model.icon}</span>
                    <h4 className="text-sm font-medium text-white">{model.name}</h4>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{model.desc}</p>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">{model.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* Clustering / Hotspots */}
            <div className="glass-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <FiMapPin className="text-civic-accent" /> DBSCAN Clusters & Hotspots
              </h3>
              {heatmapData.clusters.length === 0 ? (
                <p className="text-sm text-slate-500">No clusters computed yet. Submit complaints to generate clusters.</p>
              ) : (
                <div className="space-y-3">
                  {heatmapData.clusters.map((c, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.03] flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                        <FiAlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white capitalize">{c.dominant_category?.replace('_', ' ') || 'Mixed'}</p>
                          <span className="text-xs text-slate-400">{c.complaint_count} issues</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>Risk: <span className={`font-semibold ${c.risk_score > 0.7 ? 'text-red-400' : c.risk_score > 0.4 ? 'text-amber-400' : 'text-green-400'}`}>{(c.risk_score * 100).toFixed(0)}%</span></span>
                          <span>📍 {c.centroid_lat?.toFixed(4)}, {c.centroid_lng?.toFixed(4)}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${c.risk_score * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Areas */}
            <div className="glass-card p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <FiAlertTriangle className="text-civic-warning" /> Risk Area Analysis
              </h3>
              {riskAreas.length === 0 ? (
                <div>
                  <p className="text-sm text-slate-500 mb-3">Risk area data computed from complaint density and severity patterns.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] text-center">
                      <p className="text-2xl font-bold text-civic-accent">{heatmapData.points.length}</p>
                      <p className="text-xs text-slate-400">Active Complaints</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] text-center">
                      <p className="text-2xl font-bold text-red-400">{heatmapData.clusters.length}</p>
                      <p className="text-xs text-slate-400">Hotspot Clusters</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] text-center">
                      <p className="text-2xl font-bold text-amber-400">{heatmapData.points.filter(p => p.severity === 'critical' || p.severity === 'high').length}</p>
                      <p className="text-xs text-slate-400">High Priority</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] text-center">
                      <p className="text-2xl font-bold text-emerald-400">{heatmapData.points.filter(p => p.severity === 'low').length}</p>
                      <p className="text-xs text-slate-400">Low Priority</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {riskAreas.map((area, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white">{area.area || area.category || `Zone ${i + 1}`}</p>
                        <span className={`text-xs font-medium ${area.riskLevel === 'high' ? 'text-red-400' : area.riskLevel === 'medium' ? 'text-amber-400' : 'text-green-400'}`}>
                          {area.riskLevel || 'medium'} risk
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{area.complaintCount || area.count || 0} complaints • {area.dominantIssue || area.dominant_category || 'mixed'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Duplicate Detection Insights */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <FiShield className="text-purple-400" /> Duplicate Detection (CLIP Embeddings)
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              CLIP generates 512-dim embeddings for images and text. Complaints with cosine similarity &gt; 0.85 are flagged as potential duplicates.
            </p>
            {duplicateInsights ? (
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-white/[0.03] text-center">
                  <p className="text-2xl font-bold text-purple-400">{duplicateInsights.totalDuplicates || duplicateInsights.total_flagged || 0}</p>
                  <p className="text-xs text-slate-400">Duplicates Flagged</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03] text-center">
                  <p className="text-2xl font-bold text-civic-accent">{duplicateInsights.totalEmbeddings || duplicateInsights.total_embeddings || 0}</p>
                  <p className="text-xs text-slate-400">Total Embeddings</p>
                </div>
                <div className="p-4 rounded-lg bg-white/[0.03] text-center">
                  <p className="text-2xl font-bold text-emerald-400">{duplicateInsights.uniqueComplaints || duplicateInsights.unique || 0}</p>
                  <p className="text-xs text-slate-400">Unique Complaints</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No duplicate data available yet.</p>
            )}
          </div>

          {/* Severity Scoring Formula */}
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <FiZap className="text-amber-400" /> Severity Scoring Formula
            </h3>
            <div className="p-4 rounded-lg bg-white/[0.03] font-mono text-sm text-slate-300">
              <p>priority_score = (</p>
              <p className="pl-4 text-red-400">0.30 × hazard_severity <span className="text-slate-500">// YOLOv8 confidence</span></p>
              <p className="pl-4 text-amber-400">0.25 × text_severity <span className="text-slate-500">// BERT classification</span></p>
              <p className="pl-4 text-blue-400">0.20 × complaint_density <span className="text-slate-500">// DBSCAN cluster size</span></p>
              <p className="pl-4 text-green-400">0.15 × recency_score <span className="text-slate-500">// newer = higher priority</span></p>
              <p className="pl-4 text-purple-400">0.10 × population_impact <span className="text-slate-500">// area population data</span></p>
              <p>)</p>
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <h5 className="text-xs font-medium text-slate-300 mb-1">Department Routing</h5>
                <p className="text-xs text-slate-400">AI auto-assigns complaints to the correct city department using YOLOv8 labels + BERT categories mapped to department jurisdiction.</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.03]">
                <h5 className="text-xs font-medium text-slate-300 mb-1">Deadline Calculation</h5>
                <p className="text-xs text-slate-400">Critical: 24h • High: 48h • Medium: 5 days • Low: 10 days — auto-computed based on severity.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================== USERS TAB =================== */}
      {activeTab === 'users' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">User Management</h3>
            <button onClick={loadUsers} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-civic-accent/10 text-civic-accent text-sm hover:bg-civic-accent/20 transition-all">
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-20"><FiLoader className="w-6 h-6 text-civic-accent animate-spin" /></div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-civic-border/50">
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase">User</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase">Joined</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-civic-border/30 hover:bg-white/[0.02]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-civic-accent/10 flex items-center justify-center text-civic-accent font-semibold text-sm">
                              {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-sm text-white">{u.full_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-400">{u.email}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                            u.role === 'department_head' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)}
                            className="px-2 py-1 rounded-lg bg-civic-dark border border-civic-border text-white text-xs outline-none focus:border-civic-accent">
                            <option value="citizen">Citizen</option>
                            <option value="admin">Admin</option>
                            <option value="department_head">Dept Head</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">No users found.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
