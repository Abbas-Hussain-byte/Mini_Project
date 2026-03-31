const axios = require('axios');
const FormData = require('form-data');
const { YOLO_LABEL_MAP, CATEGORY_DANGER_SCORE } = require('../utils/constants');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

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
    description: description || ''
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
          result.title = completeResponse.data.title || result.title;
          result.description = completeResponse.data.description || result.description;
          result.analysis.imageDetections = completeResponse.data.detections || [];
          result.detectedLabels = completeResponse.data.labels || [];
          result.severity = completeResponse.data.severity || 'medium';
          result.analysis.category = completeResponse.data.category;
          result.analysis.confidence = completeResponse.data.confidence;
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
          else if (maxConfidence > 0.6) result.analysis.imageSeverity = 'high';
          else if (maxConfidence > 0.4) result.analysis.imageSeverity = 'medium';
          else result.analysis.imageSeverity = 'low';
        }
      } catch (err) {
        console.warn('Image analysis failed:', err.message);
      }
    }

    // 2. Video analysis
    if (videoUrl) {
      try {
        const videoResponse = await axios.post(`${ML_URL}/ml/analyze-image`, {
          image_url: videoUrl
        }, { timeout: 45000 });

        if (videoResponse.data && videoResponse.data.detections) {
          result.analysis.videoDetections = videoResponse.data.detections;
          const videoLabels = videoResponse.data.detections.map(d => d.label);
          result.detectedLabels = [...new Set([...result.detectedLabels, ...videoLabels])];
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

    // 5. Calculate combined severity
    const severityMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const reverseSeverityMap = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };

    const imageSev = severityMap[result.analysis.imageSeverity] || 2;
    const textSev = severityMap[result.analysis.textSeverity] || 2;
    const combinedSev = Math.round(0.6 * imageSev + 0.4 * textSev);
    result.severity = reverseSeverityMap[Math.min(combinedSev, 4)] || 'medium';

    // 6. Calculate priority score
    result.priorityScore = calculatePriority(result.severity, result.analysis);

  } catch (err) {
    console.error('AI analysis pipeline error:', err.message);
  }

  return result;
}

function calculatePriority(severity, analysis) {
  const severityMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
  const imageSev = severityMap[analysis.imageSeverity] || 2;
  const textSev = severityMap[analysis.textSeverity] || 2;
  const hazardScore = imageSev / 4;
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
    0.20 * textScore +
    0.10 * recencyScore +
    0.10 * confidence
  );

  return parseFloat(Math.min(priorityScore, 1.0).toFixed(4));
}

module.exports = { analyzeComplaint };
