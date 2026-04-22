const axios = require('axios');
const FormData = require('form-data');
const { YOLO_LABEL_MAP, CATEGORY_DANGER_SCORE } = require('../utils/constants');

// Title templates for image-only mode (replicated from ML service)
const LABEL_TITLES = {
  'damaged_road': 'Damaged Road Surface Detected — Requires Road Maintenance',
  'pothole': 'Pothole Detected on Road — Risk of Vehicle Damage',
  'illegal_parking': 'Illegal Parking Violation — Obstructing Traffic Flow',
  'broken_road_sign': 'Broken/Missing Road Sign — Traffic Safety Hazard',
  'fallen_trees': 'Fallen Tree Blocking Area — Urgent Clearance Needed',
  'littering': 'Littering / Garbage Accumulation — Sanitation Required',
  'vandalism': 'Vandalism / Property Damage — Law Enforcement Alert',
  'dead_animal': 'Dead Animal on Road — Biohazard Cleanup Needed',
  'damaged_concrete': 'Damaged Concrete Structure — Public Works Repair Needed',
  'damaged_electric_wires': 'Damaged / Exposed Electric Wires — Electrocution Risk',
};

// Detailed descriptions for image-only auto-generated complaints
const LABEL_DESCRIPTIONS = {
  'damaged_road': 'AI analysis detected damaged road surface. The road shows signs of deterioration including cracks, breaks, or surface damage that could be hazardous for vehicles and pedestrians. Requires attention from the Roads & Infrastructure department.',
  'pothole': 'AI analysis detected a pothole on the road surface. Potholes can cause vehicle damage and accidents, especially at night. Immediate repair recommended by the Roads department.',
  'illegal_parking': 'AI analysis detected an illegally parked vehicle obstructing normal traffic flow or blocking public access. Traffic enforcement action recommended.',
  'broken_road_sign': 'AI analysis detected a broken, damaged, or missing road sign. This is a traffic safety concern as missing signage can lead to accidents. Traffic department should replace/repair the sign.',
  'fallen_trees': 'AI analysis detected a fallen tree blocking the road or public area. This poses an immediate obstruction hazard and needs urgent clearance by the Parks & Environment department.',
  'littering': 'AI analysis detected littering and garbage accumulation in the area. Sanitation department should arrange for cleanup to maintain public hygiene.',
  'vandalism': 'AI analysis detected vandalism or property damage. Evidence of intentional destruction of public or private property. Law enforcement notification recommended.',
  'dead_animal': 'AI analysis detected a dead animal on or near the road. This is a biohazard and sanitation concern requiring prompt removal by the Sanitation department.',
  'damaged_concrete': 'AI analysis detected damage to a concrete structure such as a sidewalk, wall, or overpass. Public Works department should assess structural integrity and arrange repairs.',
  'damaged_electric_wires': 'AI analysis detected damaged or exposed electric wires/poles. THIS IS A HIGH-PRIORITY SAFETY HAZARD with risk of electrocution. Electricity department must be notified immediately for emergency repair.',
};

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const SEVERITY_RANK = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
const RANK_TO_SEVERITY = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };

/**
 * Run full AI analysis pipeline on a complaint
 * Calls ML service for: image analysis, text classification, embeddings
 * Supports image-only mode where AI generates title/description
 */
async function analyzeComplaint({ title, description, imageUrls, videoUrl, latitude, longitude, mode }) {
  const result = {
    analysis: {},
    detectedLabels: [],
    severity: 'medium',
    priorityScore: 0,
    title: title || 'New Civic Issue Reported',
    description: description || 'Image-based civic issue report awaiting detailed classification.',
    category: 'other'
  };

  try {
    // For image-only mode, use the /ml/analyze-complete endpoint
    if (mode === 'image_only' && imageUrls && imageUrls.length > 0) {
      try {
        const completeResponse = await axios.post(`${ML_URL}/ml/analyze-complete`, {
          image_url: imageUrls[0],
          text: ''
        }, { timeout: 30000 });

        if (completeResponse.data) {
          const mlData = completeResponse.data;
          result.title = mlData.title || result.title;
          result.description = mlData.description || result.description;
          result.analysis.imageDetections = mlData.detections || [];
          result.detectedLabels = mlData.labels || [];
          result.severity = mlData.severity || 'medium';
          result.analysis.category = mlData.category;
          result.analysis.confidence = mlData.confidence;
          result.analysis.textCategory = mlData.text_analysis?.category;
          result.analysis.textSeverity = mlData.text_analysis?.severity;
          result.analysis.textConfidence = mlData.text_analysis?.confidence;
          result.analysis.imageSeverity = mlData.severity;
          result.category = mlData.category || 'other';
          result.priorityScore = calculatePriority(result.severity, result.analysis);
          return result;
        }
      } catch (err) {
        console.warn('Complete analysis failed, trying individual endpoints:', err.message);
      }
    }

    // Start parallel requests for individual models if the main aggregate endpoint isn't used or fails
    const fullText = `${title || ''}. ${description || ''}`.trim();
    const promises = [];

    // 1. Image analysis (YOLOv8 hazard detection)
    if (imageUrls && imageUrls.length > 0) {
      promises.push(axios.post(`${ML_URL}/ml/analyze-image`, {
        image_url: imageUrls[0]
      }, { timeout: 35000 }).then(res => ({ type: 'image', data: res.data })));
    } else {
      promises.push(Promise.resolve({ type: 'image', data: null }));
    }

    // 2. Text classification
    if (fullText.length > 2) {
      promises.push(axios.post(`${ML_URL}/ml/classify-text`, {
        text: fullText
      }, { timeout: 25000 }).then(res => ({ type: 'text', data: res.data })));
    } else {
      promises.push(Promise.resolve({ type: 'text', data: null }));
    }

    // 3. Embeddings
    promises.push(axios.post(`${ML_URL}/ml/embed`, {
      text: fullText || 'civic issue',
      image_url: (imageUrls && imageUrls.length > 0) ? imageUrls[0] : null
    }, { timeout: 25000 }).then(res => ({ type: 'embed', data: res.data })));

    // Run individual models in PARALLEL to minimize total wait time
    const promiseResults = await Promise.allSettled(promises);

    // Process Parallel Results
    promiseResults.forEach(res => {
      if (res.status === 'fulfilled' && res.value.data) {
        const { type, data } = res.value;
        if (type === 'image' && data.detections) {
          result.analysis.imageDetections = data.detections;
          result.detectedLabels = data.detections.map(d => d.label);
          
          const maxConf = Math.max(...data.detections.map(d => d.confidence || 0));
          if (maxConf > 0.8) result.analysis.imageSeverity = 'critical';
          else if (maxConf > 0.5) result.analysis.imageSeverity = 'high';
          else if (maxConf > 0.3) result.analysis.imageSeverity = 'medium';
          else result.analysis.imageSeverity = 'low';

          if (data.detections.length > 0) {
            const topDet = data.detections.reduce((a, b) => a.confidence > b.confidence ? a : b);
            result.analysis.category = topDet.label;
            result.category = topDet.label;

            if (result.title === 'New Civic Issue Reported' || !result.title) {
              result.title = LABEL_TITLES[topDet.label] || `${topDet.label.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Detected`;
            }
            if (result.description === 'Image-based civic issue report awaiting detailed classification.' || !result.description) {
              const baseDesc = LABEL_DESCRIPTIONS[topDet.label] || `AI analysis detected ${topDet.label.replace(/_/g, ' ')}.`;
              result.description = `${baseDesc} Detected with ${(topDet.confidence * 100).toFixed(0)}% confidence.`;
            }
          }
        }
        
        if (type === 'text') {
          result.analysis.textCategory = data.category;
          result.analysis.textSeverity = data.severity;
          result.analysis.textConfidence = data.confidence;
          if (result.detectedLabels.length === 0 && data.category) {
            result.detectedLabels = [data.category];
            result.category = data.category;
          }
        }

        if (type === 'embed') {
          result.analysis.embeddings = {
            hasTextEmbedding: !!data.text_embedding,
            hasImageEmbedding: !!data.image_embedding
          };
        }
      } else if (res.status === 'rejected') {
        console.warn(`Parallel AI step failed: ${res.reason?.message}`);
      }
    });

    // 4. Video (Keep separate as it's very heavy and has its own long timeout)
    if (videoUrl) {
      try {
        const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 30000 });
        const formData = new FormData();
        formData.append('video', Buffer.from(videoResponse.data), { filename: 'video.mp4', contentType: 'video/mp4' });

        const mlVideoResponse = await axios.post(`${ML_URL}/ml/analyze-video`, formData, {
          headers: formData.getHeaders(),
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024
        });

        if (mlVideoResponse.data) {
          const vDetections = [];
          if (mlVideoResponse.data.frame_results) {
            mlVideoResponse.data.frame_results.forEach(fr => fr.detections && vDetections.push(...fr.detections));
          }
          result.analysis.videoDetections = vDetections;
          const vLabels = vDetections.map(d => d.label);
          result.detectedLabels = [...new Set([...result.detectedLabels, ...vLabels])];
          
          if (result.detectedLabels.length === 0 && mlVideoResponse.data.aggregated?.top_label) {
            result.category = mlVideoResponse.data.aggregated.top_label;
            result.analysis.category = mlVideoResponse.data.aggregated.top_label;
          }
          result.analysis.videoSeverity = mlVideoResponse.data.aggregated?.severity || 'medium';
        }
      } catch (err) { console.warn('Video analysis failed:', err.message); }
    }

    // 5. Calculate combined severity
    const imageSev = SEVERITY_RANK[result.analysis.imageSeverity] || 1;
    const textSev = SEVERITY_RANK[result.analysis.textSeverity] || 1;
    const videoSev = SEVERITY_RANK[result.analysis.videoSeverity] || 1;
    const combinedSev = Math.max(imageSev, textSev, videoSev);
    result.severity = RANK_TO_SEVERITY[Math.min(combinedSev, 4)] || 'medium';

    // 6. Calculate priority score
    result.priorityScore = calculatePriority(result.severity, result.analysis);

  } catch (err) {
    console.error('AI analysis pipeline error:', err.message);
  }

  return result;
}

function calculatePriority(severity, analysis) {
  const imageSev = SEVERITY_RANK[analysis.imageSeverity] || 1;
  const textSev = SEVERITY_RANK[analysis.textSeverity] || 1;
  const maxSev = Math.max(imageSev, textSev);
  const hazardScore = maxSev / 4;
  const textScore = textSev / 4;
  const recencyScore = 1.0;

  // Category-based danger score — the KEY differentiator
  const category = analysis.category || analysis.textCategory || 'other';
  const categoryDanger = CATEGORY_DANGER_SCORE[category] || 0.30;

  // Detection confidence (higher confidence = higher priority)
  const confidence = analysis.confidence || analysis.textConfidence || 0.5;

  // New formula: category danger is weighted highest (35%)
  // This ensures electric wires (0.95) gets very different score from littering (0.20)
  const priorityScore = (
    0.35 * categoryDanger +
    0.25 * hazardScore +
    0.15 * textScore +
    0.15 * recencyScore +
    0.10 * (analysis.confidence || 0.5)
  );

  return parseFloat(Math.min(priorityScore, 1.0).toFixed(4));
}

module.exports = { analyzeComplaint };
