const { supabaseAdmin } = require('../models/supabaseClient');
const { EMERGENCY_CATEGORIES, SEVERITY_DEADLINE_HOURS, CATEGORY_TO_DEPARTMENT } = require('../utils/constants');

/**
 * Disaster Response Service
 * Auto-escalates critical complaints past their deadline
 * Prevents "Noida techie case" by ensuring life-threatening issues get immediate attention
 */

/**
 * Check all active complaints and escalate any that are:
 * 1. Critical/high severity AND past their deadline
 * 2. In an emergency category AND unresolved for too long
 * 3. Have been submitted but no department acknowledged yet
 */
async function checkAndEscalate() {
  try {
    const now = new Date();

    // Find critical/high complaints with assignments past deadline
    const { data: overdueAssignments } = await supabaseAdmin
      .from('department_assignments')
      .select('*, complaints(id, title, severity, category, status, priority_score, created_at)')
      .in('status', ['pending', 'acknowledged'])
      .not('deadline', 'is', null);

    const escalated = [];

    for (const assignment of (overdueAssignments || [])) {
      const complaint = assignment.complaints;
      if (!complaint) continue;

      const deadline = new Date(assignment.deadline);
      const isOverdue = deadline < now;
      const isEmergency = EMERGENCY_CATEGORIES.includes(complaint.category);
      const isCritical = ['critical', 'high'].includes(complaint.severity);

      // Escalate if: (overdue AND critical/high) OR (overdue AND emergency category)
      if (isOverdue && (isCritical || isEmergency)) {
        // Boost priority to maximum
        await supabaseAdmin
          .from('complaints')
          .update({
            priority_score: 1.0,
            status: 'escalated',
            updated_at: now.toISOString()
          })
          .eq('id', complaint.id);

        // Mark assignment as escalated
        await supabaseAdmin
          .from('department_assignments')
          .update({ status: 'escalated' })
          .eq('id', assignment.id);

        // Create audit trail
        await supabaseAdmin
          .from('complaint_updates')
          .insert({
            complaint_id: complaint.id,
            updated_by: null,
            old_status: complaint.status,
            new_status: 'escalated',
            comment: `[DISASTER ALERT] 🚨 Auto-escalated: ${complaint.severity} severity "${complaint.category}" complaint is OVERDUE (deadline was ${deadline.toISOString()}). Immediate action required!`
          });

        escalated.push({
          complaintId: complaint.id,
          title: complaint.title,
          category: complaint.category,
          severity: complaint.severity,
          deadline: assignment.deadline,
          hoursOverdue: ((now - deadline) / (1000 * 60 * 60)).toFixed(1)
        });
      }
    }

    // Also check for critical complaints with NO assignment at all (fell through cracks)
    const { data: unassigned } = await supabaseAdmin
      .from('complaints')
      .select('id, title, severity, category, created_at')
      .in('severity', ['critical', 'high'])
      .in('status', ['submitted'])
      .is('department_id', null);

    for (const complaint of (unassigned || [])) {
      const ageHours = (now - new Date(complaint.created_at)) / (1000 * 60 * 60);
      const maxWaitHours = complaint.severity === 'critical' ? 2 : 6; // 2hrs for critical, 6hrs for high

      if (ageHours > maxWaitHours) {
        // Auto-escalate unassigned critical complaints
        await supabaseAdmin
          .from('complaints')
          .update({
            priority_score: 1.0,
            status: 'escalated',
            updated_at: now.toISOString()
          })
          .eq('id', complaint.id);

        await supabaseAdmin
          .from('complaint_updates')
          .insert({
            complaint_id: complaint.id,
            updated_by: null,
            old_status: 'submitted',
            new_status: 'escalated',
            comment: `[DISASTER ALERT] 🚨 UNASSIGNED critical complaint for ${ageHours.toFixed(1)} hours! No department has been assigned. Requires immediate manual routing.`
          });

        escalated.push({
          complaintId: complaint.id,
          title: complaint.title,
          category: complaint.category,
          severity: complaint.severity,
          hoursWaiting: ageHours.toFixed(1),
          reason: 'Unassigned critical complaint'
        });
      }
    }

    return { escalated, count: escalated.length, checkedAt: now.toISOString() };
  } catch (err) {
    console.error('Disaster escalation check failed:', err.message);
    throw err;
  }
}

/**
 * Get all currently escalated/disaster-level complaints
 */
async function getDisasterAlerts() {
  const { data: alerts } = await supabaseAdmin
    .from('complaints')
    .select('*, departments(name, code), department_assignments(status, deadline, assigned_at, workers_assigned)')
    .eq('status', 'escalated')
    .order('priority_score', { ascending: false });

  // Also get overdue critical complaints that haven't been escalated yet
  const { data: atRisk } = await supabaseAdmin
    .from('department_assignments')
    .select('*, complaints(id, title, severity, category, status, priority_score, created_at, departments(name))')
    .in('status', ['pending', 'acknowledged'])
    .not('deadline', 'is', null);

  const now = new Date();
  const overdueAtRisk = (atRisk || []).filter(a => {
    const deadline = new Date(a.deadline);
    return deadline < now && ['critical', 'high'].includes(a.complaints?.severity);
  }).map(a => ({
    ...a.complaints,
    assignmentStatus: a.status,
    deadline: a.deadline,
    hoursOverdue: ((now - new Date(a.deadline)) / (1000 * 60 * 60)).toFixed(1)
  }));

  return {
    escalatedComplaints: alerts || [],
    atRiskComplaints: overdueAtRisk,
    totalAlerts: (alerts || []).length + overdueAtRisk.length
  };
}

/**
 * Manually escalate a specific complaint
 */
async function escalateComplaint(complaintId, escalatedBy) {
  const { data: complaint } = await supabaseAdmin
    .from('complaints')
    .select('*')
    .eq('id', complaintId)
    .single();

  if (!complaint) throw new Error('Complaint not found');

  await supabaseAdmin
    .from('complaints')
    .update({
      priority_score: 1.0,
      status: 'escalated',
      updated_at: new Date().toISOString()
    })
    .eq('id', complaintId);

  await supabaseAdmin
    .from('complaint_updates')
    .insert({
      complaint_id: complaintId,
      updated_by: escalatedBy,
      old_status: complaint.status,
      new_status: 'escalated',
      comment: `[DISASTER ALERT] 🚨 Manually escalated by admin. Previous status: ${complaint.status}`
    });

  return { message: 'Complaint escalated', complaintId };
}

module.exports = { checkAndEscalate, getDisasterAlerts, escalateComplaint };
