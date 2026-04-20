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
    title: title || 'Civic Issue Reported',
    description: description || '',
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

    // 1. Image analysis (YOLOv8 hazard detection)
    if (imageUrls && imageUrls.length > 0) {
      try {
        const imageResponse = await axios.post(`${ML_URL}/ml/analyze-image`, {
          image_url: imageUrls[0]
        }, { timeout: 30000 });

        if (imageResponse.data && imageResponse.data.detections) {
          result.analysis.imageDetections = imageResponse.data.detections;
          result.detectedLabels = imageResponse.data.detections.map(d => d.label);

          const maxConfidence = Math.max(...imageResponse.data.detections.map(d => d.confidence || 0));
          if (maxConfidence > 0.8) result.analysis.imageSeverity = 'critical';
          else if (maxConfidence > 0.5) result.analysis.imageSeverity = 'high';
          else if (maxConfidence > 0.3) result.analysis.imageSeverity = 'medium';
          else result.analysis.imageSeverity = 'low';

          // Set category from top YOLO detection
          if (imageResponse.data.detections.length > 0) {
            const topDet = imageResponse.data.detections.reduce((a, b) => a.confidence > b.confidence ? a : b);
            result.analysis.category = topDet.label;
            result.category = topDet.label;

            // NEW: Populate title and description from fallback templates if not already set
            if (result.title === 'image submission' || result.title === 'Civic Issue Reported') {
              result.title = LABEL_TITLES[topDet.label] || `${topDet.label.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Detected`;
            }
            if (!result.description || result.description === 'Image-based complaint') {
              const baseDesc = LABEL_DESCRIPTIONS[topDet.label] || `AI analysis detected ${topDet.label.replace(/_/g, ' ')}.`;
              const confidenceDesc = `Detected with ${(topDet.confidence * 100).toFixed(0)}% confidence.`;
              result.description = `${baseDesc} ${confidenceDesc}`;
            }
          }
        }
      } catch (err) {
        console.warn('Image analysis failed:', err.message);
      }
    }

    // 2. Video analysis — download video and send to /ml/analyze-video
    if (videoUrl) {
      try {
        // Download the video file from the storage URL
        const videoResponse = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });

        const formData = new FormData();
        formData.append('video', Buffer.from(videoResponse.data), {
          filename: 'video.mp4',
          contentType: 'video/mp4'
        });

        const mlVideoResponse = await axios.post(`${ML_URL}/ml/analyze-video`, formData, {
          headers: formData.getHeaders(),
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024
        });

        if (mlVideoResponse.data) {
          result.analysis.videoDetections = [];
          const agg = mlVideoResponse.data.aggregated;

          // Extract detections from all frames
          if (mlVideoResponse.data.frame_results) {
            for (const fr of mlVideoResponse.data.frame_results) {
              if (fr.detections) {
                result.analysis.videoDetections.push(...fr.detections);
              }
            }
          }

          const videoLabels = result.analysis.videoDetections.map(d => d.label);
          result.detectedLabels = [...new Set([...result.detectedLabels, ...videoLabels])];

          // If no image detections but video has detections, use video results
          if (result.detectedLabels.length === 0 && agg && agg.top_label) {
            result.category = agg.top_label;
            result.analysis.category = agg.top_label;
          }

          result.analysis.framesAnalyzed = mlVideoResponse.data.frames_analyzed;
          result.analysis.videoSeverity = agg?.severity || 'medium';
        }
      } catch (err) {
        console.warn('Video analysis failed:', err.message);
      }
    }

    // 3. Text classification
    const fullText = `${title || ''}. ${description || ''}`.trim();
    if (fullText.length > 2) {
      try {
        const textResponse = await axios.post(`${ML_URL}/ml/classify-text`, {
          text: fullText
        }, { timeout: 15000 });

        if (textResponse.data) {
          result.analysis.textCategory = textResponse.data.category;
          result.analysis.textSeverity = textResponse.data.severity;
          result.analysis.textConfidence = textResponse.data.confidence;

          if (result.detectedLabels.length === 0 && textResponse.data.category) {
            result.detectedLabels = [textResponse.data.category];
            result.category = textResponse.data.category;
          }
        }
      } catch (err) {
        console.warn('Text classification failed:', err.message);
      }
    }

    // 4. Generate embeddings for duplicate detection
    try {
      const embedResponse = await axios.post(`${ML_URL}/ml/embed`, {
        text: fullText || 'civic issue',
        image_url: imageUrls && imageUrls.length > 0 ? imageUrls[0] : null
      }, { timeout: 20000 });

      if (embedResponse.data) {
        result.analysis.embeddings = {
          hasTextEmbedding: !!embedResponse.data.text_embedding,
          hasImageEmbedding: !!embedResponse.data.image_embedding
        };
      }
    } catch (err) {
      console.warn('Embedding generation failed:', err.message);
    }

    // 5. Calculate combined severity — take the MAX of all severity sources
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
//     0.35 * categoryDanger +
//     0.25 * hazardScore +
//     0.20 * textScore +
//     0.10 * recencyScore +
//     0.10 * confidence
    
    0.35 * hazardScore +
    0.25 * textScore +
    0.15 * (analysis.confidence || 0.5) +
    0.15 * recencyScore +
    0.10 * 0.5

  );

  return parseFloat(Math.min(priorityScore, 1.0).toFixed(4));
}

module.exports = { analyzeComplaint };
