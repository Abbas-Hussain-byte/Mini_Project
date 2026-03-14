const { supabaseAdmin } = require('../models/supabaseClient');
const { SEVERITY_DEADLINE_HOURS } = require('../utils/constants');

/**
 * GET /api/departments — List all departments with stats
 */
exports.getAllDepartments = async (req, res, next) => {
  try {
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name');

    // Enrich with assignment counts
    const enriched = await Promise.all((departments || []).map(async (dept) => {
      const { count: totalAssignments } = await supabaseAdmin
        .from('department_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', dept.id);

      const { count: activeAssignments } = await supabaseAdmin
        .from('department_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', dept.id)
        .in('status', ['pending', 'acknowledged', 'in_progress']);

      const { count: completedAssignments } = await supabaseAdmin
        .from('department_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', dept.id)
        .eq('status', 'completed');

      const { count: workerCount } = await supabaseAdmin
        .from('department_workers')
        .select('*', { count: 'exact', head: true })
        .eq('department_id', dept.id);

      return {
        ...dept,
        totalAssignments: totalAssignments || 0,
        activeAssignments: activeAssignments || 0,
        completedAssignments: completedAssignments || 0,
        workerCount: workerCount || 0,
        completionRate: totalAssignments > 0
          ? ((completedAssignments / totalAssignments) * 100).toFixed(1)
          : 0
      };
    }));

    res.json({ departments: enriched });
  } catch (err) { next(err); }
};

/**
 * GET /api/departments/:id — Single department details
 */
exports.getDepartmentById = async (req, res, next) => {
  try {
    const { data: dept, error } = await supabaseAdmin
      .from('departments')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !dept) return res.status(404).json({ error: 'Department not found' });

    res.json({ department: dept });
  } catch (err) { next(err); }
};

/**
 * GET /api/departments/:id/assignments — Department assignments
 */
exports.getDepartmentAssignments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('department_assignments')
      .select('*, complaints(title, description, severity, category, latitude, longitude, image_urls, created_at)', { count: 'exact' })
      .eq('department_id', req.params.id)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });

    // Check for overdue assignments
    const now = new Date();
    const enriched = (data || []).map(a => ({
      ...a,
      isOverdue: a.deadline && new Date(a.deadline) < now && !['completed', 'rejected'].includes(a.status)
    }));

    res.json({
      assignments: enriched,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: count }
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/departments/:id/workers — Department workers
 */
exports.getDepartmentWorkers = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('department_workers')
      .select('*')
      .eq('department_id', req.params.id)
      .order('name');

    if (error) return res.status(500).json({ error: error.message });

    res.json({ workers: data || [] });
  } catch (err) { next(err); }
};

/**
 * POST /api/departments/:id/assignments — Manual assignment
 */
exports.createAssignment = async (req, res, next) => {
  try {
    const { complaint_id, workers_assigned, notes } = req.body;

    if (!complaint_id) return res.status(400).json({ error: 'complaint_id is required' });

    // Get complaint severity for deadline
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('severity')
      .eq('id', complaint_id)
      .single();

    const deadlineHours = SEVERITY_DEADLINE_HOURS[complaint?.severity || 'medium'];
    const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('department_assignments')
      .insert({
        complaint_id,
        department_id: req.params.id,
        assignment_reason: 'Manual assignment by admin',
        assigned_by: 'admin',
        workers_assigned: workers_assigned || 0,
        deadline,
        notes
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Update complaint status and department
    await supabaseAdmin
      .from('complaints')
      .update({ status: 'assigned', department_id: req.params.id })
      .eq('id', complaint_id);

    res.status(201).json({ message: 'Assignment created', assignment: data });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/departments/assignments/:id — Update assignment
 */
exports.updateAssignment = async (req, res, next) => {
  try {
    const { status, workers_assigned, notes } = req.body;
    const updateData = {};

    if (status) {
      updateData.status = status;
      if (status === 'acknowledged') updateData.acknowledged_at = new Date().toISOString();
      if (status === 'in_progress') updateData.started_at = new Date().toISOString();
      if (status === 'completed') updateData.completed_at = new Date().toISOString();
    }
    if (workers_assigned !== undefined) updateData.workers_assigned = workers_assigned;
    if (notes) updateData.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('department_assignments')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*, complaints(id)')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Sync complaint status
    if (status && data.complaints?.id) {
      const complaintStatusMap = {
        'acknowledged': 'assigned',
        'in_progress': 'in_progress',
        'completed': 'resolved'
      };
      if (complaintStatusMap[status]) {
        const updateObj = { status: complaintStatusMap[status], updated_at: new Date().toISOString() };
        if (status === 'completed') updateObj.resolved_at = new Date().toISOString();
        await supabaseAdmin.from('complaints').update(updateObj).eq('id', data.complaints.id);
      }
    }

    res.json({ message: 'Assignment updated', assignment: data });
  } catch (err) { next(err); }
};

/**
 * GET /api/departments/performance — All departments performance
 */
exports.getDepartmentPerformance = async (req, res, next) => {
  try {
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('id, name, code')
      .eq('is_active', true);

    const performance = await Promise.all((departments || []).map(async (dept) => {
      const { data: assignments } = await supabaseAdmin
        .from('department_assignments')
        .select('status, assigned_at, completed_at, deadline')
        .eq('department_id', dept.id);

      const total = (assignments || []).length;
      const completed = (assignments || []).filter(a => a.status === 'completed').length;
      const overdue = (assignments || []).filter(a =>
        a.deadline && new Date(a.deadline) < new Date() && !['completed', 'rejected'].includes(a.status)
      ).length;

      // Avg resolution time
      const resolvedTimes = (assignments || [])
        .filter(a => a.completed_at)
        .map(a => (new Date(a.completed_at) - new Date(a.assigned_at)) / (1000 * 60 * 60));
      const avgResolutionHours = resolvedTimes.length > 0
        ? resolvedTimes.reduce((s, t) => s + t, 0) / resolvedTimes.length
        : 0;

      return {
        ...dept,
        totalAssignments: total,
        completed,
        overdue,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        overdueRate: total > 0 ? ((overdue / total) * 100).toFixed(1) : 0,
        avgResolutionHours: avgResolutionHours.toFixed(1)
      };
    }));

    res.json({ performance });
  } catch (err) { next(err); }
};
