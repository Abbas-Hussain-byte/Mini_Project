const { supabaseAdmin } = require('../models/supabaseClient');
const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * POST /api/cctv/streams — Add a stream
 */
exports.addStream = async (req, res, next) => {
  try {
    const { name, stream_url, stream_type, latitude, longitude } = req.body;

    if (!name || !stream_url) {
      return res.status(400).json({ error: 'name and stream_url are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('cctv_streams')
      .insert({
        name,
        stream_url,
        stream_type: stream_type || 'http',
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ message: 'Stream added', stream: data });
  } catch (err) { next(err); }
};

/**
 * GET /api/cctv/streams — List all streams
 */
exports.getStreams = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('cctv_streams')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json({ streams: data || [] });
  } catch (err) { next(err); }
};

/**
 * POST /api/cctv/analyze — Trigger frame analysis
 */
exports.analyzeFrame = async (req, res, next) => {
  try {
    const { stream_id, image_url } = req.body;

    if (!stream_id) return res.status(400).json({ error: 'stream_id is required' });

    // Call ML service to analyze frame
    let analysisResult = {};
    try {
      const response = await axios.post(`${ML_URL}/ml/analyze-image`, {
        image_url: image_url
      }, { timeout: 30000 });
      analysisResult = response.data;
    } catch (mlErr) {
      return res.status(503).json({ error: 'ML service unavailable', details: mlErr.message });
    }

    // Update stream with latest analysis
    await supabaseAdmin
      .from('cctv_streams')
      .update({
        last_analysis: analysisResult,
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', stream_id);

    // If hazards detected, auto-create complaints
    if (analysisResult.detections && analysisResult.detections.length > 0) {
      const { data: stream } = await supabaseAdmin
        .from('cctv_streams')
        .select('latitude, longitude, name')
        .eq('id', stream_id)
        .single();

      for (const detection of analysisResult.detections) {
        await supabaseAdmin
          .from('complaints')
          .insert({
            title: `[CCTV Alert] ${detection.label} detected at ${stream?.name || 'CCTV'}`,
            description: `Automated detection from CCTV stream. Confidence: ${(detection.confidence * 100).toFixed(1)}%`,
            category: detection.label,
            latitude: stream?.latitude || 0,
            longitude: stream?.longitude || 0,
            severity: detection.confidence > 0.8 ? 'high' : 'medium',
            status: 'under_review',
            ai_analysis: { source: 'cctv', stream_id, detection },
            ai_detected_labels: [detection.label]
          });
      }
    }

    res.json({
      message: 'Frame analyzed',
      analysis: analysisResult,
      alertsCreated: (analysisResult.detections || []).length
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/cctv/alerts — Recent CCTV-generated alerts
 */
exports.getAlerts = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('*, departments(name, code)')
      .contains('ai_analysis', { source: 'cctv' })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ alerts: data || [] });
  } catch (err) { next(err); }
};
