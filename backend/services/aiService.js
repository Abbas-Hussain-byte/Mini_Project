const axios = require('axios');
const { YOLO_LABEL_MAP } = require('../utils/constants');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Run full AI analysis pipeline on a complaint
 * Calls ML service for: image analysis, text classification, embeddings
 */
async function analyzeComplaint({ title, description, imageUrls, latitude, longitude }) {
  const result = {
    analysis: {},
    detectedLabels: [],
    severity: 'medium',
    priorityScore: 0
  };

  try {
    // 1. Image analysis (YOLOv8 hazard detection)
    if (imageUrls && imageUrls.length > 0) {
      try {
        const imageResponse = await axios.post(`${ML_URL}/ml/analyze-image`, {
          image_url: imageUrls[0]
        }, { timeout: 30000 });

        if (imageResponse.data && imageResponse.data.detections) {
          result.analysis.imageDetections = imageResponse.data.detections;
          result.detectedLabels = imageResponse.data.detections.map(d => d.label);
          
          // Use highest confidence detection for severity
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

    // 2. Text classification (BERT)
    try {
      const textResponse = await axios.post(`${ML_URL}/ml/classify-text`, {
        text: `${title}. ${description}`
      }, { timeout: 15000 });

      if (textResponse.data) {
        result.analysis.textCategory = textResponse.data.category;
        result.analysis.textSeverity = textResponse.data.severity;
        result.analysis.textConfidence = textResponse.data.confidence;

        // If no image labels, use text category
        if (result.detectedLabels.length === 0 && textResponse.data.category) {
          result.detectedLabels = [textResponse.data.category];
        }
      }
    } catch (err) {
      console.warn('Text classification failed:', err.message);
    }

    // 3. Generate embeddings for duplicate detection
    try {
      const embedResponse = await axios.post(`${ML_URL}/ml/embed`, {
        text: `${title}. ${description}`,
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

    // 4. Calculate combined severity
    const severityMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    const reverseSeverityMap = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };

    const imageSev = severityMap[result.analysis.imageSeverity] || 2;
    const textSev = severityMap[result.analysis.textSeverity] || 2;
    const combinedSev = Math.round(0.6 * imageSev + 0.4 * textSev);
    result.severity = reverseSeverityMap[Math.min(combinedSev, 4)] || 'medium';

    // 5. Calculate priority score (0-1)
    const hazardScore = (imageSev / 4);
    const textScore = (textSev / 4);
    const recencyScore = 1.0; // New complaint = max recency
    result.priorityScore = (
      0.30 * hazardScore +
      0.25 * textScore +
      0.20 * 0.5 + // density placeholder
      0.15 * recencyScore +
      0.10 * 0.5   // population placeholder
    );

    result.analysis.priorityBreakdown = {
      hazardScore: hazardScore.toFixed(2),
      textScore: textScore.toFixed(2),
      recencyScore: recencyScore.toFixed(2),
      totalScore: result.priorityScore.toFixed(3)
    };

  } catch (err) {
    console.error('AI analysis pipeline error:', err.message);
  }

  return result;
}

module.exports = { analyzeComplaint };
