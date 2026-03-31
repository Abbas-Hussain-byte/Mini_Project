const { supabaseAdmin } = require('../models/supabaseClient');
const { analyzeComplaint } = require('../services/aiService');
const { routeToDepartment } = require('../services/departmentRoutingService');
const { runClustering } = require('../services/clusteringService');

/**
 * POST /api/complaints — Create a new complaint
 * Supports modes: 'image_only', 'image_text', 'text_only'
 */
exports.createComplaint = async (req, res, next) => {
  try {
    const { title, description, category, latitude, longitude, address, mode, is_emergency } = req.body;

    // For image_only mode: title and description are optional (AI fills them)
    const isImageOnly = mode === 'image_only';
    if (!isImageOnly && !title) {
      return res.status(400).json({ error: 'title is required (or use mode=image_only)' });
    }
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    // 1. Upload images/videos to Supabase Storage
    let imageUrls = [];
    let videoUrl = null;
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isVideo = file.mimetype.startsWith('video/');
        const bucket = isVideo ? 'complaint-videos' : 'complaint-images';
        const ext = file.mimetype.split('/')[1] || 'bin';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .upload(fileName, file.buffer, { contentType: file.mimetype });

        if (!error) {
          const { data: urlData } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(fileName);
          if (isVideo) {
            videoUrl = urlData.publicUrl;
          } else {
            imageUrls.push(urlData.publicUrl);
          }
        }
      }
    }

    // 2. Run AI analysis
    let aiAnalysis = {};
    let detectedLabels = [];
    let severity = req.body.severity || 'medium';
    let priorityScore = 0;
    let aiTitle = title || 'Civic Issue Reported';
    let aiDescription = description || '';
//     const isEmergency = is_emergency === 'true' || is_emergency === true;
    let aiCategory = category || 'other';

    try {
      const analysisResult = await analyzeComplaint({
        title: title || 'image submission',
        description: description || 'Image-based complaint',
        imageUrls,
        videoUrl,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        mode: mode || 'image_text'
      });
      aiAnalysis = analysisResult.analysis || {};
      detectedLabels = analysisResult.detectedLabels || [];
      severity = analysisResult.severity || severity;
      priorityScore = analysisResult.priorityScore || 0;

      // Use AI-determined category if the user didn't provide one
      if (!category && analysisResult.category && analysisResult.category !== 'other') {
        aiCategory = analysisResult.category;
      }

      // For image_only mode: use AI-generated title and description
      if (isImageOnly) {
        aiTitle = analysisResult.title || aiTitle;
        aiDescription = analysisResult.description || aiDescription;
      }
    } catch (aiErr) {
      console.warn('⚠️ AI analysis failed, proceeding with manual data:', aiErr.message);
    }

    // 3. Check for duplicates before inserting
    let duplicateOf = null;
    let duplicateInfo = null;
    try {
      const latDelta = 0.005; // ~500m
      const lngDelta = 0.005;
      const cat = aiCategory;

      const { data: nearbyComplaints } = await supabaseAdmin
        .from('complaints')
        .select('id, title, priority_score, severity, created_at')
        .eq('category', cat)
        .gte('latitude', parseFloat(latitude) - latDelta)
        .lte('latitude', parseFloat(latitude) + latDelta)
        .gte('longitude', parseFloat(longitude) - lngDelta)
        .lte('longitude', parseFloat(longitude) + lngDelta)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .neq('status', 'resolved')
        .neq('status', 'rejected')
        .limit(5);

      if (nearbyComplaints && nearbyComplaints.length > 0) {
        // Link to the first match as duplicate
        const original = nearbyComplaints[0];
        duplicateOf = original.id;
        duplicateInfo = {
          originalId: original.id,
          originalTitle: original.title,
          message: 'A similar complaint already exists nearby. Your report has been linked and the original priority has been boosted!'
        };

        // Boost original complaint priority (+10%) and upgrade severity if new complaint is more severe
        const SEVER_RANK = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        const boostedPriority = Math.min((original.priority_score || 0.5) * 1.1, 1.0);
        const originalSevRank = SEVER_RANK[original.severity] || 2;
        const newSevRank = SEVER_RANK[severity] || 2;
        const updateObj = { priority_score: parseFloat(boostedPriority.toFixed(4)) };
        if (newSevRank > originalSevRank) {
          updateObj.severity = severity;
        }
        await supabaseAdmin
          .from('complaints')
          .update(updateObj)
          .eq('id', original.id);
      }
    } catch (dupErr) {
      console.warn('⚠️ Duplicate check failed:', dupErr.message);
    }

    // 4. Override severity for emergencies
    if (isEmergency) severity = 'critical';

    // 5. Insert complaint
    const { data: complaint, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        user_id: req.user.id,
        title: isImageOnly ? aiTitle : title,
        description: isImageOnly ? aiDescription : (description || ''),
        category: aiCategory,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        severity,
        image_urls: imageUrls,
        ai_analysis: { ...aiAnalysis, videoUrl },
        ai_detected_labels: detectedLabels,
        priority_score: isEmergency ? Math.max(priorityScore, 0.95) : priorityScore,
        duplicate_of: duplicateOf,
        status: duplicateOf ? 'duplicate' : (isEmergency ? 'escalated' : 'submitted')
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 5. Auto-assign to department (skip for duplicates)
    if (!duplicateOf) {
      try {
        await routeToDepartment(complaint);
      } catch (deptErr) {
        console.warn('⚠️ Department routing failed:', deptErr.message);
      }
    }

    // 6. Trigger clustering update (async, non-blocking)
    runClustering().catch(err => console.warn('⚠️ Clustering update failed:', err.message));

    // 6. Fetch the updated complaint with department info
    const { data: fullComplaint } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .eq('id', complaint.id)
      .single();

    res.status(201).json({
      message: duplicateOf
        ? 'Complaint linked as duplicate — original priority boosted!'
        : 'Complaint submitted successfully',
      complaint: fullComplaint,
      duplicate: duplicateInfo,
      aiGenerated: isImageOnly ? { title: aiTitle, description: aiDescription } : null
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
 * PATCH /api/complaints/:id — Update complaint status (admin/dept_head)
 */
exports.updateComplaint = async (req, res, next) => {
  try {
    const { status, severity, category, notes } = req.body;
    const updateData = { updated_at: new Date().toISOString() };

    // Dept heads can only set status to pending_verification, not resolved
    const userRole = req.user.role;
    if (status === 'resolved' && userRole !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can mark complaints as resolved. Use pending_verification instead.'
      });
    }

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
 * POST /api/complaints/:id/verify — Admin verifies resolution
 */
exports.verifyResolution = async (req, res, next) => {
  try {
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Complaint must be in pending_verification status' });
    }

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin
      .from('complaint_updates')
      .insert({
        complaint_id: req.params.id,
        updated_by: req.user.id,
        old_status: 'pending_verification',
        new_status: 'resolved',
        comment: req.body.notes || 'Resolution verified by admin'
      });

    res.json({ message: 'Resolution verified successfully', complaint: data });
  } catch (err) { next(err); }
};

/**
 * POST /api/complaints/:id/reject-resolution — Admin rejects dept resolution
 */
exports.rejectResolution = async (req, res, next) => {
  try {
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ error: 'notes explaining rejection are required' });

    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    if (complaint.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Complaint must be in pending_verification status' });
    }

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabaseAdmin
      .from('complaint_updates')
      .insert({
        complaint_id: req.params.id,
        updated_by: req.user.id,
        old_status: 'pending_verification',
        new_status: 'in_progress',
        comment: `Resolution REJECTED by admin: ${notes}`
      });

    res.json({ message: 'Resolution rejected — sent back for further work', complaint: data });
  } catch (err) { next(err); }
};

/**
 * GET /api/complaints/nearby — Complaints within radius
 */
exports.getNearbyComplaints = async (req, res, next) => {
  try {
    const { lat, lng, radius_km = 1 } = req.query;

    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

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
    const { data: complaint } = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const latDelta = 0.005;
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
