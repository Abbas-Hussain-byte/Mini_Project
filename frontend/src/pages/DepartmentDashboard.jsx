import { useState, useEffect } from 'react';
import { departmentsAPI } from '../services/api';
import { FiUsers, FiCheckCircle, FiAlertTriangle, FiClock, FiLoader, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const STATUS_BADGES = {
  pending: 'bg-slate-500/20 text-slate-400',
  acknowledged: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  escalated: 'bg-red-500/20 text-red-400',
};

export default function DepartmentDashboard() {
  const [departments, setDepartments] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [deptRes, perfRes] = await Promise.all([
        departmentsAPI.getAll(),
        departmentsAPI.getPerformance()
      ]);
      setDepartments(deptRes.data.departments || []);
      setPerformance(perfRes.data.performance || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleExpand = async (deptId) => {
    if (expanded === deptId) return setExpanded(null);
    setExpanded(deptId);
    if (!assignments[deptId]) {
      try {
        const { data } = await departmentsAPI.getAssignments(deptId, { limit: 10 });
        setAssignments({ ...assignments, [deptId]: data.assignments || [] });
      } catch (err) { console.error(err); }
    }
  };

  const updateAssignment = async (assignmentId, status) => {
    try {
      await departmentsAPI.updateAssignment(assignmentId, { status });
      // Refresh
      if (expanded) {
        const { data } = await departmentsAPI.getAssignments(expanded, { limit: 10 });
        setAssignments({ ...assignments, [expanded]: data.assignments || [] });
      }
      loadData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><FiLoader className="w-8 h-8 text-civic-accent animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-1">Department Management</h1>
      <p className="text-slate-400 text-sm mb-8">AI-routed assignments, worker allocation, and performance tracking</p>

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
            <div className="p-5 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={() => toggleExpand(dept.id)}>
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
                  {expanded === dept.id ? <FiChevronUp className="text-slate-400" /> : <FiChevronDown className="text-slate-400" />}
                </div>
              </div>
            </div>

            {expanded === dept.id && (
              <div className="border-t border-civic-border/50 p-5 animate-slide-up">
                <h4 className="text-sm font-medium text-slate-300 mb-3">Recent Assignments</h4>
                {(assignments[dept.id] || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No assignments yet</p>
                ) : (
                  <div className="space-y-3">
                    {(assignments[dept.id] || []).map(a => (
                      <div key={a.id} className="p-3 rounded-lg bg-white/[0.03] flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{a.complaints?.title || 'Complaint'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{a.assignment_reason}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className={`px-2 py-0.5 rounded-full ${STATUS_BADGES[a.status]}`}>{a.status}</span>
                            {a.isOverdue && <span className="text-red-400 flex items-center gap-1"><FiAlertTriangle size={12} /> Overdue</span>}
                            <span className="text-slate-500"><FiClock size={12} className="inline mr-1" />{new Date(a.assigned_at).toLocaleDateString()}</span>
                            {a.workers_assigned > 0 && <span className="text-slate-400">{a.workers_assigned} workers</span>}
                          </div>
                        </div>
                        {!['completed', 'rejected'].includes(a.status) && (
                          <div className="flex gap-1">
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
  );
}
