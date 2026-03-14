const { supabaseAdmin } = require('../models/supabaseClient');
const { analyzeComplaint } = require('../services/aiService');
const { routeToDepartment } = require('../services/departmentRoutingService');

/**
 * POST /api/complaints — Create a new complaint
 */
exports.createComplaint = async (req, res, next) => {
  try {
    const { title, description, category, latitude, longitude, address } = req.body;

    if (!title || !description || !latitude || !longitude) {
      return res.status(400).json({ error: 'title, description, latitude, and longitude are required' });
    }

    // 1. Upload images to Supabase Storage
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${file.mimetype.split('/')[1]}`;
        const { data, error } = await supabaseAdmin.storage
          .from('complaint-images')
          .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (!error) {
          const { data: urlData } = supabaseAdmin.storage
            .from('complaint-images')
            .getPublicUrl(fileName);
          imageUrls.push(urlData.publicUrl);
        }
      }
    }

    // 2. Run AI analysis (async — non-blocking for user)
    let aiAnalysis = {};
    let detectedLabels = [];
    let severity = req.body.severity || 'medium';
    let priorityScore = 0;

    try {
      const analysisResult = await analyzeComplaint({
        title,
        description,
        imageUrls,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      });
      aiAnalysis = analysisResult.analysis || {};
      detectedLabels = analysisResult.detectedLabels || [];
      severity = analysisResult.severity || severity;
      priorityScore = analysisResult.priorityScore || 0;
    } catch (aiErr) {
      console.warn('⚠️ AI analysis failed, proceeding with manual data:', aiErr.message);
    }

    // 3. Insert complaint
    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        user_id: req.user.id,
        title,
        description,
        category: category || (detectedLabels[0] || 'other'),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        severity,
        image_urls: imageUrls,
        ai_analysis: aiAnalysis,
        ai_detected_labels: detectedLabels,
        priority_score: priorityScore
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 4. Auto-assign to department
    try {
      await routeToDepartment(complaint);
    } catch (deptErr) {
      console.warn('⚠️ Department routing failed:', deptErr.message);
    }

    // 5. Fetch the updated complaint with department info
    const { data: fullComplaint } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .eq('id', complaint.id)
      .single();

    res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint: fullComplaint
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/complaints — List complaints with pagination & filters
 */
exports.getComplaints = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20,
      status, category, severity, department_id,
      sort_by = 'created_at', order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code), profiles(full_name, email)', { count: 'exact' })
      .order(sort_by, { ascending: order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('category', category);
    if (severity) query = query.eq('severity', severity);
    if (department_id) query = query.eq('department_id', department_id);

    const { data, error, count } = await query;

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      complaints: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/complaints/:id — Single complaint detail
 */
exports.getComplaintById = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select(`
        *,
        departments(name, code),
        profiles(full_name, email),
        complaint_updates(*, profiles(full_name)),
        department_assignments(*, departments(name, code))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Complaint not found' });

    res.json({ complaint: data });
  } catch (err) { next(err); }
};

/**
 * PATCH /api/complaints/:id — Update complaint (admin)
 */
exports.updateComplaint = async (req, res, next) => {
  try {
    const { status, severity, category, notes } = req.body;
    const updateData = { updated_at: new Date().toISOString() };

    if (status) updateData.status = status;
    if (severity) updateData.severity = severity;
    if (category) updateData.category = category;
    if (status === 'resolved') updateData.resolved_at = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('complaints')
      .select('status')
      .eq('id', req.params.id)
      .single();

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Create audit trail
    await supabaseAdmin
      .from('complaint_updates')
      .insert({
        complaint_id: req.params.id,
        updated_by: req.user.id,
        old_status: existing?.status,
        new_status: status || existing?.status,
        comment: notes || `Status updated to ${status}`
      });

    res.json({ message: 'Complaint updated', complaint: data });
  } catch (err) { next(err); }
};

/**
 * GET /api/complaints/nearby — Complaints within radius
 */
exports.getNearbyComplaints = async (req, res, next) => {
  try {
    const { lat, lng, radius_km = 1 } = req.query;

    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

    // Approximate bounding box
    const latDelta = parseFloat(radius_km) / 111.0;
    const lngDelta = parseFloat(radius_km) / (111.0 * Math.cos(parseFloat(lat) * Math.PI / 180));

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .gte('latitude', parseFloat(lat) - latDelta)
      .lte('latitude', parseFloat(lat) + latDelta)
      .gte('longitude', parseFloat(lng) - lngDelta)
      .lte('longitude', parseFloat(lng) + lngDelta)
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ complaints: data, count: data.length });
  } catch (err) { next(err); }
};

/**
 * GET /api/complaints/:id/duplicates — Find potential duplicates
 */
exports.getDuplicates = async (req, res, next) => {
  try {
    // For MVP: simple text-based duplicate check using category + nearby location
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const latDelta = 0.005; // ~500m
    const lngDelta = 0.005;

    const { data: nearby } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .neq('id', req.params.id)
      .eq('category', complaint.category)
      .gte('latitude', complaint.latitude - latDelta)
      .lte('latitude', complaint.latitude + latDelta)
      .gte('longitude', complaint.longitude - lngDelta)
      .lte('longitude', complaint.longitude + lngDelta)
      .limit(10);

    res.json({ duplicates: nearby || [], count: (nearby || []).length });
  } catch (err) { next(err); }
};
