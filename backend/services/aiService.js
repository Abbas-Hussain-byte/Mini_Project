const axios = require('axios');
const FormData = require('form-data');
const { YOLO_LABEL_MAP } = require('../utils/constants');

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
          }
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
    const combinedSev = Math.max(imageSev, textSev);
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

  const priorityScore = (
    0.35 * hazardScore +
    0.25 * textScore +
    0.15 * (analysis.confidence || 0.5) +
    0.15 * recencyScore +
    0.10 * 0.5
  );

  return parseFloat(priorityScore.toFixed(3));
}

module.exports = { analyzeComplaint };
