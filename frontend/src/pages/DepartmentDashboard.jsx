import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI, complaintsAPI } from '../services/api';
import { FiBriefcase, FiUsers, FiClock, FiCheckCircle, FiAlertTriangle, FiPhone, FiMail, FiUser, FiPlus, FiTrash2, FiMessageSquare, FiUserPlus, FiMapPin, FiImage, FiHash, FiChevronDown, FiChevronUp, FiCalendar } from 'react-icons/fi';

export default function DepartmentDashboard() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [deptComplaints, setDeptComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', phone: '', role: 'field_worker' });
  const [activeSection, setActiveSection] = useState('overview');
  const [complaintUpdates, setComplaintUpdates] = useState([]);
  const [assigningComplaint, setAssigningComplaint] = useState(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [complaintWorkers, setComplaintWorkers] = useState({});
  const [expandedComplaint, setExpandedComplaint] = useState(null);

  const isAdmin = profile?.role === 'admin';
  const isDeptHead = profile?.role === 'department_head';

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await departmentsAPI.getAll();
      const deptList = res.data.departments || res.data || [];
      setDepartments(deptList);

      // If dept head, auto-select their department
      if (isDeptHead && profile?.department_id) {
        const myDept = deptList.find(d => d.id === profile.department_id);
        if (myDept) {
          selectDept(myDept);
          return;
        }
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const selectDept = useCallback(async (dept) => {
    setSelectedDept(dept.id);
    setActiveSection('overview');
    setExpandedComplaint(null);
    setLoading(true);
    try {
      const [detailRes, assignRes, workerRes] = await Promise.all([
        departmentsAPI.getById(dept.id).catch(() => ({ data: dept })),
        departmentsAPI.getAssignments(dept.id, { limit: 50 }).catch(() => ({ data: { assignments: [] } })),
        departmentsAPI.getWorkers(dept.id).catch(() => ({ data: { workers: [] } }))
      ]);
      setDeptDetail(detailRes.data.department || detailRes.data);
      setAssignments(assignRes.data.assignments || []);
      setWorkers(workerRes.data.workers || []);

      const compRes = await complaintsAPI.getAll({ department_id: dept.id, limit: 50 }).catch(() => ({ data: { complaints: [] } }));
      const comps = compRes.data.complaints || [];
      setDeptComplaints(comps);

      // Load assigned workers for each complaint
      const cwMap = {};
      await Promise.all(comps.map(async (c) => {
        try {
          const res = await departmentsAPI.getComplaintWorkers(dept.id, c.id);
          cwMap[c.id] = res.data.workers || [];
        } catch { cwMap[c.id] = []; }
      }));
      setComplaintWorkers(cwMap);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  const addWorker = async (e) => {
    e.preventDefault();
    if (!selectedDept || !newWorker.name) return;
    try {
      await departmentsAPI.addWorker(selectedDept, newWorker);
      setNewWorker({ name: '', phone: '', role: 'field_worker' });
      setShowAddWorker(false);
      selectDept({ id: selectedDept });
    } catch (err) { alert(err.response?.data?.error || 'Failed to add worker'); }
  };

  const updateWorkerStatus = async (workerId, status) => {
    try {
      await departmentsAPI.updateWorker(workerId, { status });
      selectDept({ id: selectedDept });
    } catch (err) { alert('Update failed'); }
  };

  const deleteWorker = async (workerId) => {
    if (!confirm('Remove this worker?')) return;
    try {
      await departmentsAPI.deleteWorker(workerId);
      selectDept({ id: selectedDept });
    } catch (err) { alert('Remove failed'); }
  };

  const handleComplaintStatus = async (id, status) => {
    try {
      await complaintsAPI.update(id, { status });
      selectDept({ id: selectedDept });
    } catch (err) { alert(err.response?.data?.error || 'Status update failed'); }
  };

  const loadMessages = async (complaintId) => {
    try {
      const res = await complaintsAPI.getById(complaintId);
      setComplaintUpdates(res.data.complaint?.complaint_updates || []);
    } catch (err) { console.error(err); }
  };

  const handleAssignWorkers = async (complaintId) => {
    if (selectedWorkerIds.length === 0) return alert('Select at least one worker');
    try {
      await departmentsAPI.assignWorkers(selectedDept, complaintId, { worker_ids: selectedWorkerIds });
      setAssigningComplaint(null);
      setSelectedWorkerIds([]);
      selectDept({ id: selectedDept });
    } catch (err) { alert(err.response?.data?.error || 'Assignment failed'); }
  };

  const toggleWorkerSelection = (workerId) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId) ? prev.filter(id => id !== workerId) : [...prev, workerId]
    );
  };

  const shortId = (id) => id ? id.substring(0, 8).toUpperCase() : '—';

  // Styles
  const cardStyle = { background: 'rgba(22, 27, 34, 0.85)', borderRadius: '14px', padding: '1.25rem', border: '1px solid rgba(51, 65, 85, 0.4)', transition: 'all 0.2s' };
  const inputStyle = { width: '100%', padding: '0.75rem 0.875rem', borderRadius: '10px', border: '1px solid rgba(51, 65, 85, 0.5)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 400, outline: 'none', boxSizing: 'border-box' };
  const statusColor = (s) => ({ pending: '#64748b', acknowledged: '#f59e0b', in_progress: '#a855f7', completed: '#22c55e', escalated: '#ef4444', submitted: '#64748b', under_review: '#f59e0b', assigned: '#38bdf8', pending_verification: '#eab308', resolved: '#22c55e' }[s] || '#64748b');
  const sevColor = (s) => ({ critical: '#ef4444', high: '#f59e0b', medium: '#38bdf8', low: '#22c55e' }[s] || '#64748b');

  if (loading && !selectedDept) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(56, 189, 248, 0.2)', borderTop: '3px solid #38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading department data...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '5rem 1.25rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#f0f6fc', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.375rem' }}>
            {isDeptHead ? '🏢 Department Dashboard' : '🏢 Department Management'}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: 0, fontWeight: 400 }}>
            {isDeptHead ? `Manage complaints, workers & assignments for your department` : 'Overview of all city departments and their operations'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: (isDeptHead && profile?.department_id) ? '1fr' : (selectedDept ? '280px 1fr' : '1fr'), gap: '1.5rem' }}>
          {/* Department List — hide for scoped dept heads */}
          {!(isDeptHead && profile?.department_id) && (
            <div>
              <h2 style={{ color: '#e2e8f0', fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Departments ({departments.length})</h2>
              {departments.map(dept => (
                <div key={dept.id} onClick={() => selectDept(dept)}
                  style={{
                    ...cardStyle, marginBottom: '0.5rem', cursor: 'pointer', padding: '0.875rem 1rem',
                    borderLeft: `3px solid ${selectedDept === dept.id ? '#38bdf8' : 'transparent'}`,
                    background: selectedDept === dept.id ? 'rgba(56, 189, 248, 0.06)' : cardStyle.background,
                  }}>
                  <h3 style={{ color: '#f0f6fc', margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 600 }}>{dept.name}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 500 }}>{dept.code}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{dept.workerCount || dept.total_workers || 0} workers</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Department Detail Panel */}
          {selectedDept && deptDetail && (
            <div>
              {/* Dept Name & Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ color: '#f0f6fc', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{deptDetail.name}</h2>
                <div style={{ display: 'flex', gap: '3px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '4px' }}>
                  {[
                    { id: 'overview', label: 'Overview', icon: <FiBriefcase size={14} /> },
                    { id: 'workers', label: `Workers (${workers.length})`, icon: <FiUsers size={14} /> },
                    { id: 'complaints', label: `Complaints (${deptComplaints.length})`, icon: <FiAlertTriangle size={14} /> },
                  ].map(sec => (
                    <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                      style={{
                        padding: '0.5rem 0.875rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem',
                        background: activeSection === sec.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                        color: activeSection === sec.id ? '#38bdf8' : '#64748b',
                        transition: 'all 0.2s'
                      }}>
                      {sec.icon} {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ===== OVERVIEW SECTION ===== */}
              {activeSection === 'overview' && (
                <>
                  {/* Dept Head Info */}
                  {deptDetail.head_name && (
                    <div style={{ ...cardStyle, marginBottom: '1rem', borderLeft: '3px solid #f59e0b' }}>
                      <h3 style={{ color: '#f59e0b', margin: '0 0 0.5rem', fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FiUser size={15} /> Department Head
                      </h3>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}><FiUser size={13} color="#64748b" /> {deptDetail.head_name}</span>
                        {deptDetail.head_email && <span style={{ color: '#cbd5e1', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><FiMail size={13} color="#64748b" /> {deptDetail.head_email}</span>}
                        {deptDetail.head_phone && <span style={{ color: '#cbd5e1', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><FiPhone size={13} color="#64748b" /> {deptDetail.head_phone}</span>}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Total Workers', value: workers.length, icon: <FiUsers />, color: '#38bdf8' },
                      { label: 'Active Tasks', value: assignments.filter(a => a.status === 'in_progress' || a.status === 'acknowledged').length, icon: <FiClock />, color: '#a855f7' },
                      { label: 'Completed', value: assignments.filter(a => a.status === 'completed').length, icon: <FiCheckCircle />, color: '#22c55e' },
                      { label: 'Overdue', value: assignments.filter(a => a.isOverdue).length, icon: <FiAlertTriangle />, color: '#ef4444' },
                    ].map((stat, i) => (
                      <div key={i} style={{ ...cardStyle, textAlign: 'center', padding: '1rem' }}>
                        <div style={{ color: stat.color, marginBottom: '0.375rem', fontSize: '1.25rem' }}>{stat.icon}</div>
                        <p style={{ color: '#f0f6fc', fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.125rem' }}>{stat.value}</p>
                        <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500, margin: 0 }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Quick Workers Preview */}
                  <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                    <h3 style={{ color: '#38bdf8', margin: '0 0 0.625rem', fontSize: '0.9375rem', fontWeight: 700 }}>👷 Workers ({workers.length})</h3>
                    {workers.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                        {workers.map(w => (
                          <div key={w.id} style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <p style={{ color: '#f0f6fc', fontSize: '0.875rem', margin: '0 0 0.125rem', fontWeight: 600 }}>{w.name}</p>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{w.role?.replace(/_/g, ' ')} • {w.phone || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ color: '#475569', fontSize: '0.875rem' }}>No workers added yet</p>}
                  </div>

                  {/* Quick Complaints Preview */}
                  <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                    <h3 style={{ color: '#a855f7', margin: '0 0 0.625rem', fontSize: '0.9375rem', fontWeight: 700 }}>📋 Recent Complaints ({deptComplaints.length})</h3>
                    {deptComplaints.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {deptComplaints.slice(0, 6).map(c => (
                          <div key={c.id} style={{ padding: '0.625rem 0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.6875rem', color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>#{shortId(c.id)}</span>
                                <p style={{ color: '#f0f6fc', fontSize: '0.875rem', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                              </div>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: statusColor(c.status) + '18', color: statusColor(c.status), fontWeight: 600 }}>{c.status?.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: sevColor(c.severity) + '18', color: sevColor(c.severity), fontWeight: 600 }}>{c.severity}</span>
                                {(complaintWorkers[c.id] || []).length > 0 && <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 600 }}>{(complaintWorkers[c.id] || []).length} assigned</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ color: '#475569', fontSize: '0.875rem' }}>No complaints assigned</p>}
                  </div>
                </>
              )}

              {/* ===== WORKERS SECTION ===== */}
              {activeSection === 'workers' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#e2e8f0', fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Department Workers ({workers.length})</h3>
                    {(isAdmin || isDeptHead) && (
                      <button onClick={() => setShowAddWorker(!showAddWorker)}
                        style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', border: 'none', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', transition: 'all 0.2s' }}>
                        <FiPlus size={15} /> Add Worker
                      </button>
                    )}
                  </div>

                  {showAddWorker && (
                    <form onSubmit={addWorker} style={{ ...cardStyle, marginBottom: '1rem', borderLeft: '3px solid #22c55e' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input placeholder="Worker name" value={newWorker.name} onChange={e => setNewWorker(w => ({ ...w, name: e.target.value }))} required style={inputStyle} />
                        <input placeholder="Phone number" value={newWorker.phone} onChange={e => setNewWorker(w => ({ ...w, phone: e.target.value }))} style={inputStyle} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select value={newWorker.role} onChange={e => setNewWorker(w => ({ ...w, role: e.target.value }))} style={{ ...inputStyle, flex: 1 }}>
                          <option value="field_worker">Field Worker</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="inspector">Inspector</option>
                          <option value="technician">Technician</option>
                        </select>
                        <button type="submit" style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>Add</button>
                      </div>
                    </form>
                  )}

                  {workers.map(w => (
                    <div key={w.id} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ color: '#f0f6fc', fontSize: '0.9375rem', margin: '0 0 0.25rem', fontWeight: 600 }}>{w.name}</p>
                        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 600 }}>{w.role?.replace(/_/g, ' ')}</span>
                          {w.phone && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FiPhone size={11} /> {w.phone}</span>}
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{w.active_assignments || 0} tasks</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <select value={w.status || 'available'} onChange={e => updateWorkerStatus(w.id, e.target.value)}
                          style={{ padding: '0.375rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.5)', background: 'rgba(0,0,0,0.3)', fontSize: '0.75rem', fontWeight: 600,
                            color: w.status === 'available' ? '#22c55e' : w.status === 'on_duty' ? '#a855f7' : w.status === 'on_leave' ? '#f59e0b' : '#64748b' }}>
                          <option value="available">Available</option>
                          <option value="on_duty">On Duty</option>
                          <option value="on_leave">On Leave</option>
                        </select>
                        {(isAdmin || isDeptHead) && (
                          <button onClick={() => deleteWorker(w.id)}
                            style={{ padding: '0.375rem', borderRadius: '6px', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {workers.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem', fontSize: '0.9375rem' }}>No workers in this department yet.</p>}
                </div>
              )}

              {/* ===== COMPLAINTS SECTION — FULL DETAILS ===== */}
              {activeSection === 'complaints' && (
                <div>
                  <h3 style={{ color: '#e2e8f0', fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.875rem' }}>Assigned Complaints ({deptComplaints.length})</h3>

                  {deptComplaints.map(c => (
                    <div key={c.id} style={{ ...cardStyle, marginBottom: '0.875rem', borderLeft: `3px solid ${statusColor(c.status)}` }}>
                      {/* Complaint Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.625rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* ID + Title */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>#{shortId(c.id)}</span>
                            <h4 style={{ color: '#f0f6fc', fontSize: '1rem', margin: 0, fontWeight: 600 }}>{c.title}</h4>
                          </div>

                          {/* Description */}
                          <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                            {expandedComplaint === c.id ? c.description : c.description?.slice(0, 150)}{c.description?.length > 150 && expandedComplaint !== c.id ? '...' : ''}
                          </p>

                          {/* Badges */}
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: statusColor(c.status) + '18', color: statusColor(c.status), fontWeight: 600 }}>{c.status?.replace(/_/g, ' ')}</span>
                            <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: sevColor(c.severity) + '18', color: sevColor(c.severity), fontWeight: 600 }}>{c.severity}</span>
                            <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: 'rgba(100,116,139,0.1)', color: '#94a3b8', fontWeight: 500 }}>{c.category?.replace(/_/g, ' ')}</span>
                            {c.priority_score > 0 && <span style={{ fontSize: '0.75rem', padding: '2px 10px', borderRadius: '6px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 600 }}>Priority: {(c.priority_score * 100).toFixed(0)}%</span>}
                          </div>

                          {/* Meta info */}
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FiCalendar size={11} /> {new Date(c.created_at).toLocaleDateString()}</span>
                            {c.address && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><FiMapPin size={11} /> {c.address}</span>}
                            {c.profiles?.full_name && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><FiUser size={11} /> {c.profiles.full_name}</span>}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <button onClick={() => setExpandedComplaint(expandedComplaint === c.id ? null : c.id)}
                            style={{ padding: '0.375rem 0.625rem', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.4)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                            {expandedComplaint === c.id ? <><FiChevronUp size={12} /> Less</> : <><FiChevronDown size={12} /> Details</>}
                          </button>

                          {(isDeptHead || isAdmin) && !['resolved', 'rejected', 'duplicate'].includes(c.status) && (
                            <select onChange={e => { if (e.target.value) handleComplaintStatus(c.id, e.target.value); e.target.value = ''; }}
                              defaultValue=""
                              style={{ padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(51,65,85,0.5)', background: 'rgba(0,0,0,0.3)', color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}>
                              <option value="" disabled>Update status...</option>
                              <option value="under_review">Under Review</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="pending_verification">Submit for Verification</option>
                            </select>
                          )}

                          {(isDeptHead || isAdmin) && (
                            <button onClick={() => { setAssigningComplaint(assigningComplaint === c.id ? null : c.id); setSelectedWorkerIds((complaintWorkers[c.id] || []).map(w => w.id)); }}
                              style={{ padding: '0.375rem 0.625rem', borderRadius: '6px', border: 'none', background: 'rgba(34,197,94,0.12)', color: '#22c55e', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <FiUserPlus size={12} /> Workers
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ===== EXPANDED DETAILS ===== */}
                      {expandedComplaint === c.id && (
                        <div style={{ marginTop: '0.75rem', padding: '0.875rem', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', borderTop: '1px solid rgba(51,65,85,0.3)' }}>
                          {/* Full Description */}
                          <p style={{ color: '#cbd5e1', fontSize: '0.875rem', margin: '0 0 0.75rem', lineHeight: 1.6 }}>{c.description}</p>

                          {/* Photos */}
                          {c.image_urls?.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', margin: '0 0 0.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}><FiImage size={14} /> Attached Photos ({c.image_urls.length})</p>
                              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                                {c.image_urls.map((url, i) => (
                                  <img key={i} src={url} alt={`Complaint photo ${i + 1}`}
                                    style={{ width: '140px', height: '140px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(51,65,85,0.4)', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', flexShrink: 0 }}
                                    onClick={() => window.open(url, '_blank')}
                                    onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; e.target.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
                                    onMouseOut={e => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = 'none'; }} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Full metadata */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                              <p style={{ color: '#64748b', fontSize: '0.6875rem', margin: '0 0 0.125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Complaint ID</p>
                              <p style={{ color: '#38bdf8', fontSize: '0.8125rem', margin: 0, fontWeight: 700, fontFamily: 'monospace' }}>{c.id}</p>
                            </div>
                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                              <p style={{ color: '#64748b', fontSize: '0.6875rem', margin: '0 0 0.125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filed By</p>
                              <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', margin: 0, fontWeight: 500 }}>{c.profiles?.full_name || 'Anonymous'}</p>
                            </div>
                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                              <p style={{ color: '#64748b', fontSize: '0.6875rem', margin: '0 0 0.125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filed On</p>
                              <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', margin: 0, fontWeight: 500 }}>{new Date(c.created_at).toLocaleString()}</p>
                            </div>
                            {c.address && (
                              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', gridColumn: 'span 2' }}>
                                <p style={{ color: '#64748b', fontSize: '0.6875rem', margin: '0 0 0.125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</p>
                                <p style={{ color: '#e2e8f0', fontSize: '0.8125rem', margin: 0, fontWeight: 500 }}>{c.address}</p>
                              </div>
                            )}
                          </div>

                          {/* AI labels */}
                          {c.ai_detected_labels?.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                              <p style={{ color: '#38bdf8', fontSize: '0.8125rem', margin: '0 0 0.375rem', fontWeight: 700 }}>🤖 AI Detected Labels</p>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                {c.ai_detected_labels.map((l, i) => (
                                  <span key={i} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 500, border: '1px solid rgba(56,189,248,0.15)' }}>{l.replace(/_/g, ' ')}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Messages button */}
                          <button onClick={() => loadMessages(c.id)} style={{ padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', background: 'rgba(168,85,247,0.12)', color: '#a855f7', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <FiMessageSquare size={13} /> View Messages & Timeline
                          </button>
                        </div>
                      )}

                      {/* Assigned Workers Display */}
                      {(complaintWorkers[c.id] || []).length > 0 && (
                        <div style={{ marginTop: '0.625rem', padding: '0.625rem', background: 'rgba(34,197,94,0.04)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.12)' }}>
                          <p style={{ color: '#22c55e', fontSize: '0.75rem', margin: '0 0 0.375rem', fontWeight: 700 }}>👷 Assigned Workers ({(complaintWorkers[c.id] || []).length})</p>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {(complaintWorkers[c.id] || []).map(w => (
                              <span key={w.id} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.15)', fontWeight: 500 }}>
                                {w.name} ({w.role?.replace(/_/g, ' ')}) • {w.phone || 'N/A'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Worker Assignment Panel */}
                      {assigningComplaint === c.id && (
                        <div style={{ marginTop: '0.625rem', padding: '0.875rem', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <p style={{ color: '#22c55e', fontSize: '0.875rem', margin: '0 0 0.625rem', fontWeight: 700 }}>Select workers to assign:</p>
                          {workers.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.625rem', maxHeight: '220px', overflowY: 'auto' }}>
                                {workers.map(w => (
                                  <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', borderRadius: '8px', cursor: 'pointer',
                                    background: selectedWorkerIds.includes(w.id) ? 'rgba(34,197,94,0.08)' : 'transparent',
                                    border: `1px solid ${selectedWorkerIds.includes(w.id) ? 'rgba(34,197,94,0.25)' : 'rgba(51,65,85,0.3)'}` }}>
                                    <input type="checkbox" checked={selectedWorkerIds.includes(w.id)} onChange={() => toggleWorkerSelection(w.id)} style={{ accentColor: '#22c55e' }} />
                                    <span style={{ color: '#f0f6fc', fontSize: '0.875rem', fontWeight: 500 }}>{w.name}</span>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{w.role?.replace(/_/g, ' ')}</span>
                                    <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto',
                                      background: w.status === 'available' ? 'rgba(34,197,94,0.12)' : w.status === 'on_duty' ? 'rgba(168,85,247,0.12)' : 'rgba(245,158,11,0.12)',
                                      color: w.status === 'available' ? '#22c55e' : w.status === 'on_duty' ? '#a855f7' : '#f59e0b', fontWeight: 600 }}>
                                      {w.status || 'available'}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleAssignWorkers(c.id)}
                                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700 }}>
                                  Assign {selectedWorkerIds.length} Worker(s)
                                </button>
                                <button onClick={() => { setAssigningComplaint(null); setSelectedWorkerIds([]); }}
                                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(51,65,85,0.5)', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : <p style={{ color: '#475569', fontSize: '0.875rem' }}>No workers available. Add workers first.</p>}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Messages panel */}
                  {complaintUpdates.length > 0 && (
                    <div style={{ ...cardStyle, marginTop: '1rem', borderLeft: '3px solid #a855f7' }}>
                      <h4 style={{ color: '#a855f7', margin: '0 0 0.625rem', fontSize: '0.9375rem', fontWeight: 700 }}>📜 Messages & Timeline</h4>
                      {complaintUpdates.map((upd, i) => (
                        <div key={i} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.375rem', borderRadius: '8px', background: upd.comment?.includes('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.06)' : 'rgba(0,0,0,0.12)', borderLeft: `3px solid ${upd.comment?.includes('[ADMIN MESSAGE]') ? '#a855f7' : '#334155'}` }}>
                          <p style={{ color: '#cbd5e1', fontSize: '0.8125rem', margin: 0, fontWeight: 400 }}>{upd.comment?.replace('[ADMIN MESSAGE] ', '📩 ')}</p>
                          <p style={{ color: '#475569', fontSize: '0.6875rem', margin: '0.25rem 0 0', fontWeight: 500 }}>
                            {upd.profiles?.full_name || 'System'} • {new Date(upd.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {deptComplaints.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem', fontSize: '0.9375rem' }}>No complaints assigned to this department.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
