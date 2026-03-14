"""
CivicPulse ML Service
Flask API for AI inference: YOLOv8 hazard detection, BERT text classification,
CLIP multimodal embeddings, and sentence embeddings.
"""

import os
import io
import time
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import requests as http_requests

app = Flask(__name__)
CORS(app)

# ============================================================
# Lazy-loaded models (saves RAM until first request)
# ============================================================
models = {
    'yolo': None,
    'bert_tokenizer': None,
    'bert_model': None,
    'clip_model': None,
    'clip_processor': None,
    'sentence_model': None,
}

# YOLOv8 class names (from Kaggle Urban Issues Dataset)
YOLO_CLASSES = [
    'damaged_road', 'pothole', 'illegal_parking', 'broken_road_sign',
    'fallen_trees', 'littering', 'vandalism', 'dead_animal',
    'damaged_concrete', 'damaged_electric_wires'
]

# BERT category labels for text classification
BERT_CATEGORIES = [
    'damaged_road', 'pothole', 'littering', 'water_supply',
    'drainage', 'electricity', 'fallen_trees', 'illegal_parking',
    'vandalism', 'damaged_concrete', 'broken_road_sign',
    'dead_animal', 'damaged_electric_wires', 'sewage', 'other'
]

# Severity keywords for rule-based fallback
SEVERITY_KEYWORDS = {
    'critical': ['fire', 'collapse', 'explosion', 'electrocution', 'flood', 'emergency', 'danger', 'life-threatening'],
    'high': ['broken', 'damaged', 'fallen', 'exposed wires', 'waterlogging', 'accident', 'blocked'],
    'medium': ['crack', 'pothole', 'garbage', 'leaking', 'overflow', 'noise'],
    'low': ['minor', 'cosmetic', 'faded', 'uneven', 'small', 'slightly'],
}


def load_yolo():
    """Load YOLOv8n model"""
    if models['yolo'] is None:
        print("🔄 Loading YOLOv8n model...")
        from ultralytics import YOLO
        # Use pretrained YOLOv8n — in production, use fine-tuned model
        models['yolo'] = YOLO('yolov8n.pt')
        print("✅ YOLOv8n loaded")
    return models['yolo']


def load_bert():
    """Load BERT text classifier"""
    if models['bert_tokenizer'] is None:
        print("🔄 Loading BERT tokenizer & model...")
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        model_name = 'bert-base-uncased'
        models['bert_tokenizer'] = AutoTokenizer.from_pretrained(model_name)
        # For MVP: use zero-shot classification pipeline instead of fine-tuned model
        from transformers import pipeline
        models['bert_model'] = pipeline(
            'zero-shot-classification',
            model='facebook/bart-large-mnli',
            device=-1  # CPU
        )
        print("✅ BERT/BART classifier loaded")
    return models['bert_tokenizer'], models['bert_model']


def load_clip():
    """Load CLIP model for multimodal embeddings"""
    if models['clip_model'] is None:
        print("🔄 Loading CLIP model...")
        from transformers import CLIPModel, CLIPProcessor
        models['clip_model'] = CLIPModel.from_pretrained('openai/clip-vit-base-patch32')
        models['clip_processor'] = CLIPProcessor.from_pretrained('openai/clip-vit-base-patch32')
        print("✅ CLIP loaded")
    return models['clip_model'], models['clip_processor']


def load_sentence_model():
    """Load sentence-transformers for text embeddings"""
    if models['sentence_model'] is None:
        print("🔄 Loading sentence-transformers...")
        from sentence_transformers import SentenceTransformer
        models['sentence_model'] = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Sentence model loaded")
    return models['sentence_model']


def download_image(url):
    """Download image from URL"""
    try:
        response = http_requests.get(url, timeout=10)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content)).convert('RGB')
    except Exception as e:
        print(f"❌ Image download failed: {e}")
        return None


def classify_severity(text):
    """Rule-based severity classification from text"""
    text_lower = text.lower()
    for severity, keywords in SEVERITY_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return severity
    return 'medium'


# ============================================================
# API ENDPOINTS
# ============================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'CivicPulse ML Service',
        'models_loaded': {k: v is not None for k, v in models.items()},
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ')
    })


@app.route('/ml/analyze-image', methods=['POST'])
def analyze_image():
    """YOLOv8 hazard detection on uploaded image"""
    try:
        data = request.json
        image_url = data.get('image_url')

        if not image_url:
            return jsonify({'error': 'image_url is required'}), 400

        image = download_image(image_url)
        if image is None:
            return jsonify({'error': 'Failed to download image'}), 400

        # Run YOLOv8 inference
        model = load_yolo()
        results = model(image, conf=0.25, verbose=False)

        detections = []
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                confidence = float(box.conf[0])
                label = YOLO_CLASSES[cls_id] if cls_id < len(YOLO_CLASSES) else f'class_{cls_id}'
                bbox = box.xyxy[0].tolist()

                detections.append({
                    'label': label,
                    'confidence': round(confidence, 4),
                    'bbox': [round(b, 2) for b in bbox],
                    'class_id': cls_id
                })

        return jsonify({
            'detections': detections,
            'count': len(detections),
            'model': 'yolov8n'
        })

    except Exception as e:
        print(f"❌ Image analysis error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/classify-text', methods=['POST'])
def classify_text():
    """BERT/BART text classification for complaint text"""
    try:
        data = request.json
        text = data.get('text', '')

        if not text:
            return jsonify({'error': 'text is required'}), 400

        _, classifier = load_bert()

        # Zero-shot classification
        result = classifier(
            text,
            candidate_labels=BERT_CATEGORIES,
            multi_label=False
        )

        category = result['labels'][0]
        confidence = result['scores'][0]
        severity = classify_severity(text)

        return jsonify({
            'category': category,
            'confidence': round(confidence, 4),
            'severity': severity,
            'all_scores': {
                label: round(score, 4)
                for label, score in zip(result['labels'][:5], result['scores'][:5])
            }
        })

    except Exception as e:
        print(f"❌ Text classification error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/embed', methods=['POST'])
def generate_embeddings():
    """Generate embeddings for duplicate detection"""
    try:
        data = request.json
        text = data.get('text', '')
        image_url = data.get('image_url')

        result = {}

        # Text embedding (sentence-transformers)
        if text:
            sentence_model = load_sentence_model()
            text_emb = sentence_model.encode(text)
            result['text_embedding'] = text_emb.tolist()

        # Image + Text embedding (CLIP)
        if image_url:
            try:
                image = download_image(image_url)
                if image:
                    clip_model, clip_processor = load_clip()
                    inputs = clip_processor(
                        images=image,
                        text=text if text else "civic issue",
                        return_tensors="pt",
                        padding=True
                    )
                    import torch
                    with torch.no_grad():
                        outputs = clip_model(**inputs)
                    result['image_embedding'] = outputs.image_embeds[0].numpy().tolist()
                    if text:
                        result['combined_embedding'] = (
                            (outputs.image_embeds[0].numpy() + outputs.text_embeds[0].numpy()) / 2
                        ).tolist()
            except Exception as e:
                print(f"⚠️ CLIP embedding failed: {e}")

        return jsonify(result)

    except Exception as e:
        print(f"❌ Embedding error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/similarity', methods=['POST'])
def check_similarity():
    """Compare two text embeddings for duplicate detection"""
    try:
        data = request.json
        embedding1 = np.array(data.get('embedding1', []))
        embedding2 = np.array(data.get('embedding2', []))

        if embedding1.size == 0 or embedding2.size == 0:
            return jsonify({'error': 'Both embeddings are required'}), 400

        # Cosine similarity
        similarity = float(np.dot(embedding1, embedding2) / (
            np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
        ))

        return jsonify({
            'similarity': round(similarity, 4),
            'is_duplicate': similarity > 0.85,
            'threshold': 0.85
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================
# STARTUP
# ============================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    print(f"""
╔══════════════════════════════════════════╗
║       CivicPulse ML Service             ║
║       Port: {port}                         ║
║       Models: Lazy-loaded on first use  ║
╚══════════════════════════════════════════╝
    """)

    app.run(host='0.0.0.0', port=port, debug=debug)
