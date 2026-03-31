import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { departmentsAPI, complaintsAPI } from '../services/api';
import { FiBriefcase, FiUsers, FiClock, FiCheckCircle, FiAlertTriangle, FiTrendingUp, FiPhone, FiMail, FiUser, FiPlus, FiTrash2, FiEdit2, FiMessageSquare, FiUserPlus  } from 'react-icons/fi';

export default function DepartmentDashboard() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptDetail, setDeptDetail] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [deptComplaints, setDeptComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState({ name: '', phone: '', role: 'field_worker' });
  const [editingWorker, setEditingWorker] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [complaintUpdates, setComplaintUpdates] = useState([]);
  // Worker assignment per complaint
  const [assigningComplaint, setAssigningComplaint] = useState(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [complaintWorkers, setComplaintWorkers] = useState({});

  const isAdmin = profile?.role === 'admin';
  const isDeptHead = profile?.role === 'department_head';

  useEffect(() => { loadDepartments(); }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const res = await departmentsAPI.getAll();
      setDepartments(res.data.departments || res.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const selectDept = useCallback(async (dept) => {
    setSelectedDept(dept.id);
    setActiveSection('overview');
    setLoading(true);
    try {
      const [detailRes, assignRes, workerRes] = await Promise.all([
        departmentsAPI.getById(dept.id).catch(() => ({ data: dept })),
        departmentsAPI.getAssignments(dept.id, { limit: 30 }).catch(() => ({ data: { assignments: [] } })),
        departmentsAPI.getWorkers(dept.id).catch(() => ({ data: { workers: [] } }))
      ]);
      setDeptDetail(detailRes.data.department || detailRes.data);
      setAssignments(assignRes.data.assignments || []);
      setWorkers(workerRes.data.workers || []);

      const compRes = await complaintsAPI.getAll({ department_id: dept.id, limit: 30 }).catch(() => ({ data: { complaints: [] } }));
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

  // Worker assignment per complaint
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

  const cardStyle = { background: 'rgba(22, 27, 34, 0.8)', borderRadius: '12px', padding: '1.25rem', border: '1px solid rgba(48, 54, 61, 0.5)' };
  const inputStyle = { width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#f0f6fc', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };
  const statusColor = (s) => ({ pending: '#8b949e', acknowledged: '#f59e0b', in_progress: '#a855f7', completed: '#2ea043', escalated: '#f85149', submitted: '#8b949e', under_review: '#f59e0b', assigned: '#06b6d4', pending_verification: '#eab308', resolved: '#2ea043' }[s] || '#8b949e');

  return (
    <div style={{ minHeight: '100vh', padding: '5rem 1rem 2rem', background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1117 50%, #0a1a2a 100%)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ color: '#f0f6fc', fontSize: '1.5rem', marginBottom: '0.25rem' }}>
          {isDeptHead ? 'Department Head Dashboard' : 'Department Management'}
        </h1>
        <p style={{ color: '#8b949e', marginBottom: '1.5rem' }}>
          {isDeptHead ? 'Manage your department, workers, and assigned complaints' : 'Overview of all city departments, workers, and assignments'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: selectedDept ? '260px 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Department List */}
          <div>
            <h2 style={{ color: '#c9d1d9', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Departments ({departments.length})</h2>
            {departments.map(dept => (
              <div key={dept.id} onClick={() => selectDept(dept)}
                style={{
                  ...cardStyle, marginBottom: '0.5rem', cursor: 'pointer', padding: '0.85rem 1rem',
                  borderLeft: `3px solid ${selectedDept === dept.id ? '#06b6d4' : 'transparent'}`,
                  background: selectedDept === dept.id ? 'rgba(6,182,212,0.05)' : cardStyle.background,
                  transition: 'all 0.2s'
                }}>
                <h3 style={{ color: '#f0f6fc', margin: '0 0 0.1rem', fontSize: '0.9rem' }}>{dept.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: '#06b6d4', fontSize: '0.7rem', margin: 0 }}>{dept.code}</p>
                  <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>{dept.workerCount || dept.total_workers || 0} workers</span>
                </div>
              </div>
            ))}
          </div>

          {/* Department Detail Panel */}
          {selectedDept && deptDetail && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ color: '#f0f6fc', fontSize: '1.2rem', margin: 0 }}>{deptDetail.name}</h2>
                <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '3px' }}>
                  {[
                    { id: 'overview', label: 'Overview', icon: <FiBriefcase size={13} /> },
                    { id: 'workers', label: `Workers (${workers.length})`, icon: <FiUsers size={13} /> },
                    { id: 'complaints', label: `Complaints (${deptComplaints.length})`, icon: <FiAlertTriangle size={13} /> },
                  ].map(sec => (
                    <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                      style={{ padding: '0.4rem 0.7rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                        background: activeSection === sec.id ? 'rgba(6,182,212,0.2)' : 'transparent',
                        color: activeSection === sec.id ? '#06b6d4' : '#8b949e' }}>
                      {sec.icon} {sec.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* OVERVIEW */}
              {activeSection === 'overview' && (
                <>
                  {deptDetail.head_name && (
                    <div style={{ ...cardStyle, marginBottom: '1rem', borderLeft: '3px solid #f59e0b' }}>
                      <h3 style={{ color: '#f59e0b', margin: '0 0 0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FiUser size={14} /> Department Head
                      </h3>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <span style={{ color: '#f0f6fc', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiUser size={12} color="#8b949e" /> {deptDetail.head_name}</span>
                        {deptDetail.head_email && <span style={{ color: '#c9d1d9', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiMail size={12} color="#8b949e" /> {deptDetail.head_email}</span>}
                        {deptDetail.head_phone && <span style={{ color: '#c9d1d9', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><FiPhone size={12} color="#8b949e" /> {deptDetail.head_phone}</span>}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Workers', value: workers.length, icon: <FiUsers />, color: '#06b6d4' },
                      { label: 'Active Tasks', value: assignments.filter(a => a.status === 'in_progress' || a.status === 'acknowledged').length, icon: <FiClock />, color: '#a855f7' },
                      { label: 'Completed', value: assignments.filter(a => a.status === 'completed').length, icon: <FiCheckCircle />, color: '#2ea043' },
                      { label: 'Overdue', value: assignments.filter(a => a.isOverdue).length, icon: <FiAlertTriangle />, color: '#f85149' },
                    ].map((stat, i) => (
                      <div key={i} style={{ ...cardStyle, textAlign: 'center' }}>
                        <div style={{ color: stat.color, marginBottom: '0.2rem', fontSize: '1.1rem' }}>{stat.icon}</div>
                        <p style={{ color: '#f0f6fc', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.1rem' }}>{stat.value}</p>
                        <p style={{ color: '#8b949e', fontSize: '0.7rem', margin: 0 }}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Workers — visible in overview */}
                  <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                    <h3 style={{ color: '#06b6d4', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>👷 Workers ({workers.length})</h3>
                    {workers.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
                        {workers.map(w => (
                          <div key={w.id} style={{ padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                            <p style={{ color: '#f0f6fc', fontSize: '0.8rem', margin: '0 0 0.1rem', fontWeight: 500 }}>{w.name}</p>
                            <span style={{ fontSize: '0.65rem', color: '#8b949e' }}>{w.role?.replace(/_/g, ' ')} • {w.phone || 'N/A'}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ color: '#6e7681', fontSize: '0.8rem' }}>No workers yet</p>}
                  </div>

                  {/* Complaints — visible in overview */}
                  <div style={{ ...cardStyle, marginBottom: '1rem' }}>
                    <h3 style={{ color: '#a855f7', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>📋 Complaints ({deptComplaints.length})</h3>
                    {deptComplaints.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {deptComplaints.slice(0, 8).map(c => (
                          <div key={c.id} style={{ padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ color: '#f0f6fc', fontSize: '0.8rem', margin: '0 0 0.1rem' }}>{c.title}</p>
                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: statusColor(c.status) + '15', color: statusColor(c.status) }}>{c.status?.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>{c.severity}</span>
                                {(complaintWorkers[c.id] || []).length > 0 && <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'rgba(46,160,67,0.1)', color: '#2ea043' }}>{(complaintWorkers[c.id] || []).length} workers</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p style={{ color: '#6e7681', fontSize: '0.8rem' }}>No complaints assigned</p>}
                  </div>

                  <h3 style={{ color: '#c9d1d9', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Recent Assignments</h3>
                  {assignments.slice(0, 5).map(a => (
                    <div key={a.id} style={{ ...cardStyle, marginBottom: '0.5rem', borderLeft: `3px solid ${statusColor(a.status)}`, padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ color: '#f0f6fc', fontSize: '0.85rem', margin: '0 0 0.15rem' }}>{a.complaints?.title || a.assignment_reason || 'Assignment'}</p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: statusColor(a.status) + '20', color: statusColor(a.status) }}>{a.status}</span>
                            {a.workers_assigned > 0 && <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>{a.workers_assigned} workers</span>}
                            {a.isOverdue && <span style={{ fontSize: '0.7rem', color: '#f85149' }}>⚠ OVERDUE</span>}
                          </div>
                        </div>
                        {(isDeptHead || isAdmin) && !['completed'].includes(a.status) && (
                          <select onChange={e => { if (e.target.value) { departmentsAPI.updateAssignment(a.id, { status: e.target.value }).then(() => selectDept({ id: selectedDept })); } e.target.value = ''; }}
                            defaultValue=""
                            style={{ padding: '0.3rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.7rem' }}>
                            <option value="" disabled>Update...</option>
                            <option value="acknowledged">Acknowledge</option>
                            <option value="in_progress">Start Work</option>
                            <option value="completed">Complete</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* WORKERS SECTION */}
              {activeSection === 'workers' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ color: '#c9d1d9', fontSize: '0.9rem', margin: 0 }}>Department Workers ({workers.length})</h3>
                    {(isAdmin || isDeptHead) && (
                      <button onClick={() => setShowAddWorker(!showAddWorker)}
                        style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', background: 'rgba(46,160,67,0.2)', color: '#2ea043', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <FiPlus size={14} /> Add Worker
                      </button>
                    )}
                  </div>

                  {showAddWorker && (
                    <form onSubmit={addWorker} style={{ ...cardStyle, marginBottom: '1rem', borderLeft: '3px solid #2ea043' }}>
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
                        <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#2ea043', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Add</button>
                      </div>
                    </form>
                  )}

                  {workers.map(w => (
                    <div key={w.id} style={{ ...cardStyle, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ color: '#f0f6fc', fontSize: '0.9rem', margin: '0 0 0.15rem', fontWeight: 500 }}>{w.name}</p>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{w.role?.replace(/_/g, ' ')}</span>
                          {w.phone && <span style={{ fontSize: '0.7rem', color: '#8b949e' }}><FiPhone size={10} /> {w.phone}</span>}
                          <span style={{ fontSize: '0.7rem', color: '#8b949e' }}>{w.active_assignments || 0} tasks</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <select value={w.status || 'available'} onChange={e => updateWorkerStatus(w.id, e.target.value)}
                          style={{ padding: '0.3rem 0.4rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', fontSize: '0.7rem',
                            color: w.status === 'available' ? '#2ea043' : w.status === 'on_duty' ? '#a855f7' : w.status === 'on_leave' ? '#f59e0b' : '#8b949e' }}>
                          <option value="available">Available</option>
                          <option value="on_duty">On Duty</option>
                          <option value="on_leave">On Leave</option>
                        </select>
                        {(isAdmin || isDeptHead) && (
                          <button onClick={() => deleteWorker(w.id)}
                            style={{ padding: '0.3rem', borderRadius: '4px', border: 'none', background: 'rgba(248,81,73,0.1)', color: '#f85149', cursor: 'pointer' }}>
                            <FiTrash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {workers.length === 0 && <p style={{ color: '#8b949e', textAlign: 'center', padding: '1.5rem' }}>No workers in this department yet.</p>}
                </div>
              )}

              {/* COMPLAINTS SECTION (with Worker Assignment) */}
              {activeSection === 'complaints' && (
                <div>
                  <h3 style={{ color: '#c9d1d9', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Assigned Complaints ({deptComplaints.length})</h3>

                  {deptComplaints.map(c => (
                    <div key={c.id} style={{ ...cardStyle, marginBottom: '0.75rem', borderLeft: `3px solid ${statusColor(c.status)}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#f0f6fc', fontSize: '0.9rem', margin: '0 0 0.2rem', fontWeight: 500 }}>{c.title}</p>
                          <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: '0 0 0.4rem' }}>{c.description?.slice(0, 100)}</p>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: statusColor(c.status) + '20', color: statusColor(c.status) }}>{c.status?.replace(/_/g, ' ')}</span>
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>{c.severity}</span>
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(139,148,158,0.1)', color: '#8b949e' }}>{c.category?.replace(/_/g, ' ')}</span>
                            {c.priority_score > 0 && <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>P: {c.priority_score?.toFixed(3)}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(isDeptHead || isAdmin) && !['resolved', 'rejected', 'duplicate'].includes(c.status) && (
                            <select onChange={e => { if (e.target.value) handleComplaintStatus(c.id, e.target.value); e.target.value = ''; }}
                              defaultValue=""
                              style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'rgba(0,0,0,0.3)', color: '#c9d1d9', fontSize: '0.75rem' }}>
                              <option value="" disabled>Update status...</option>
                              <option value="under_review">Under Review</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="pending_verification">Submit for Verification</option>
                            </select>
                          )}

                          {(isDeptHead || isAdmin) && (
                            <button onClick={() => { setAssigningComplaint(assigningComplaint === c.id ? null : c.id); setSelectedWorkerIds((complaintWorkers[c.id] || []).map(w => w.id)); }}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: 'none', background: 'rgba(46,160,67,0.15)', color: '#2ea043', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <FiUserPlus size={12} /> Assign Workers
                            </button>
                          )}

                          <button onClick={() => loadMessages(c.id)} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: 'none', background: 'rgba(168,85,247,0.1)', color: '#a855f7', cursor: 'pointer', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <FiMessageSquare size={11} /> Messages
                          </button>
                        </div>
                      </div>

                      {/* Assigned Workers Display */}
                      {(complaintWorkers[c.id] || []).length > 0 && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(46,160,67,0.05)', borderRadius: '6px', border: '1px solid rgba(46,160,67,0.15)' }}>
                          <p style={{ color: '#2ea043', fontSize: '0.7rem', margin: '0 0 0.3rem', fontWeight: 600 }}>👷 Assigned Workers ({(complaintWorkers[c.id] || []).length})</p>
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {(complaintWorkers[c.id] || []).map(w => (
                              <span key={w.id} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                                {w.name} ({w.role?.replace(/_/g, ' ')}) • {w.phone || 'N/A'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Worker Assignment Panel */}
                      {assigningComplaint === c.id && (
                        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(46,160,67,0.2)' }}>
                          <p style={{ color: '#2ea043', fontSize: '0.8rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Select workers to assign:</p>
                          {workers.length > 0 ? (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {workers.map(w => (
                                  <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '6px', cursor: 'pointer',
                                    background: selectedWorkerIds.includes(w.id) ? 'rgba(46,160,67,0.1)' : 'transparent',
                                    border: `1px solid ${selectedWorkerIds.includes(w.id) ? 'rgba(46,160,67,0.3)' : 'rgba(48,54,61,0.3)'}` }}>
                                    <input type="checkbox" checked={selectedWorkerIds.includes(w.id)} onChange={() => toggleWorkerSelection(w.id)} style={{ accentColor: '#2ea043' }} />
                                    <span style={{ color: '#f0f6fc', fontSize: '0.85rem' }}>{w.name}</span>
                                    <span style={{ color: '#8b949e', fontSize: '0.7rem' }}>{w.role?.replace(/_/g, ' ')}</span>
                                    <span style={{ color: '#6e7681', fontSize: '0.7rem' }}>{w.phone || ''}</span>
                                    <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', marginLeft: 'auto',
                                      background: w.status === 'available' ? 'rgba(46,160,67,0.15)' : w.status === 'on_duty' ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.15)',
                                      color: w.status === 'available' ? '#2ea043' : w.status === 'on_duty' ? '#a855f7' : '#f59e0b' }}>
                                      {w.status || 'available'}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleAssignWorkers(c.id)}
                                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', background: '#2ea043', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                                  Assign {selectedWorkerIds.length} Worker(s)
                                </button>
                                <button onClick={() => { setAssigningComplaint(null); setSelectedWorkerIds([]); }}
                                  style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(48,54,61,0.8)', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: '0.8rem' }}>
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : <p style={{ color: '#6e7681', fontSize: '0.8rem' }}>No workers available. Add workers first.</p>}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Messages panel */}
                  {complaintUpdates.length > 0 && (
                    <div style={{ ...cardStyle, marginTop: '1rem', borderLeft: '3px solid #a855f7' }}>
                      <h4 style={{ color: '#a855f7', margin: '0 0 0.5rem', fontSize: '0.85rem' }}>Messages & Updates</h4>
                      {complaintUpdates.map((upd, i) => (
                        <div key={i} style={{ padding: '0.4rem 0.6rem', marginBottom: '0.3rem', borderRadius: '6px', background: upd.comment?.includes('[ADMIN MESSAGE]') ? 'rgba(168,85,247,0.08)' : 'rgba(0,0,0,0.15)', borderLeft: `2px solid ${upd.comment?.includes('[ADMIN MESSAGE]') ? '#a855f7' : '#48535f'}` }}>
                          <p style={{ color: '#c9d1d9', fontSize: '0.8rem', margin: 0 }}>{upd.comment?.replace('[ADMIN MESSAGE] ', '📩 ')}</p>
                          <p style={{ color: '#6e7681', fontSize: '0.65rem', margin: '0.1rem 0 0' }}>
                            {upd.profiles?.full_name || 'System'} • {new Date(upd.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {deptComplaints.length === 0 && <p style={{ color: '#8b949e', textAlign: 'center', padding: '1.5rem' }}>No complaints assigned to this department.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
