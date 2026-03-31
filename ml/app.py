"""
CivicPulse ML Service
Flask API for AI inference: YOLOv8 hazard detection, zero-shot text classification,
CLIP multimodal embeddings, and sentence embeddings.

Models chosen for free-tier / CPU deployment:
  - YOLOv8n (6MB, ~40ms inference)
  - distilbert-base-uncased-mnli (250MB, ~200ms, 5x faster than BART-large)
  - all-MiniLM-L6-v2 (80MB, ~15ms per sentence)
  - CLIP ViT-B/32 (600MB, loaded lazily)
"""

import os
import io
import time
import tempfile
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import requests as http_requests

# CRITICAL: Disable Ultralytics auto-install to prevent pi-heif crash on Windows
os.environ['YOLO_AUTOINSTALL'] = 'false'

app = Flask(__name__)
CORS(app)

# ============================================================
# Lazy-loaded models (saves RAM until first request)
# ============================================================
models = {
    'yolo': None,
    'text_classifier': None,
    'clip_model': None,
    'clip_processor': None,
    'sentence_model': None,
}

# YOLOv8 class names (Kaggle Urban Issues Dataset)
YOLO_CLASSES = [
    'damaged_road', 'pothole', 'illegal_parking', 'broken_road_sign',
    'fallen_trees', 'littering', 'vandalism', 'dead_animal',
    'damaged_concrete', 'damaged_electric_wires'
]

# BERT category labels for text classification
BERT_CATEGORIES = [
    'damaged road', 'pothole', 'garbage and waste', 'sanitation and debris',
    'littering', 'water supply issue', 'drainage problem', 'electricity issue',
    'fallen trees', 'illegal parking', 'vandalism', 'damaged concrete',
    'broken road sign', 'dead animal', 'damaged electric wires',
    'sewage overflow', 'noise pollution', 'encroachment',
    'stray animals', 'streetlight issue', 'other civic issue'
]

# Mapping from human-readable labels back to DB categories
LABEL_TO_CATEGORY = {
    'damaged road': 'damaged_road',
    'pothole': 'pothole',
    'garbage and waste': 'sanitation',
    'sanitation and debris': 'sanitation',
    'littering': 'littering',
    'water supply issue': 'water_supply',
    'drainage problem': 'drainage',
    'electricity issue': 'electricity',
    'fallen trees': 'fallen_trees',
    'illegal parking': 'illegal_parking',
    'vandalism': 'vandalism',
    'damaged concrete': 'damaged_concrete',
    'broken road sign': 'broken_road_sign',
    'dead animal': 'dead_animal',
    'damaged electric wires': 'damaged_electric_wires',
    'sewage overflow': 'sewage',
    'noise pollution': 'noise_pollution',
    'encroachment': 'encroachment',
    'stray animals': 'stray_animals',
    'streetlight issue': 'streetlight',
    'other civic issue': 'other'
}

# Severity keywords for rule-based fallback
SEVERITY_KEYWORDS = {
    'critical': ['fire', 'collapse', 'explosion', 'electrocution', 'flood', 'emergency', 'danger', 'life-threatening', 'sparking', 'exposed wire'],
    'high': ['broken', 'damaged', 'fallen', 'exposed wires', 'waterlogging', 'accident', 'blocked', 'burst', 'overflow', 'deep pothole', 'major garbage', 'excess debris', 'sewage'],
    'medium': ['crack', 'pothole', 'garbage', 'debris', 'waste', 'leaking', 'overflow', 'noise', 'littering', 'graffiti', 'stray', 'encroach'],
    'low': ['minor', 'cosmetic', 'faded', 'uneven', 'small', 'slightly', 'peeling'],
}

# Title templates for image-only mode
LABEL_TITLES = {
    'damaged_road': 'Damaged Road Surface Detected',
    'pothole': 'Pothole Detected on Road',
    'illegal_parking': 'Illegal Parking Violation',
    'broken_road_sign': 'Broken/Missing Road Sign',
    'fallen_trees': 'Fallen Tree Blocking Area',
    'littering': 'Littering / Garbage Accumulation',
    'vandalism': 'Vandalism / Property Damage',
    'dead_animal': 'Dead Animal on Road',
    'damaged_concrete': 'Damaged Concrete Structure',
    'damaged_electric_wires': 'Damaged / Exposed Electric Wires',
}


def load_yolo():
    """Load YOLOv8n model (fine-tuned > HF download > pretrained)"""
    if models['yolo'] is None:
        print("🔄 Loading YOLOv8n model...")
        from ultralytics import YOLO
        # Check for fine-tuned model first
        finetuned_path = os.path.join(os.path.dirname(__file__), 'models', 'yolo-urban', 'best.pt')
        if os.path.exists(finetuned_path):
            print(f"   Using fine-tuned model: {finetuned_path}")
            models['yolo'] = YOLO(finetuned_path)
        else:
            # Try to auto-download from HuggingFace
            try:
                from huggingface_hub import hf_hub_download
                print("   Fine-tuned model not found. Downloading from HuggingFace...")
                target_dir = os.path.join(os.path.dirname(__file__), 'models', 'yolo-urban')
                os.makedirs(target_dir, exist_ok=True)
                downloaded = hf_hub_download(
                    repo_id="AkinduH/Urban-Issues-Detection",
                    filename="best.pt",
                    repo_type="space",
                    local_dir=target_dir,
                    local_dir_use_symlinks=False
                )
                dl_path = os.path.join(target_dir, 'best.pt')
                if downloaded != dl_path and os.path.exists(downloaded):
                    import shutil
                    shutil.move(downloaded, dl_path)
                print(f"   ✅ Downloaded fine-tuned model to {dl_path}")
                models['yolo'] = YOLO(dl_path)
            except Exception as hf_err:
                print(f"   ⚠️ HF download failed ({hf_err}), using pretrained YOLOv8n")
                models['yolo'] = YOLO('yolov8n.pt')
        print("✅ YOLOv8n loaded")
    return models['yolo']


def load_text_classifier():
    """Load lightweight zero-shot classifier (DistilBERT — 5x faster than BART)"""
    if models['text_classifier'] is None:
        print("🔄 Loading DistilBERT-MNLI classifier (~250MB)...")
        from transformers import pipeline
        models['text_classifier'] = pipeline(
            'zero-shot-classification',
            model='typeform/distilbert-base-uncased-mnli',
            device=-1  # CPU
        )
        print("✅ DistilBERT classifier loaded")
    return models['text_classifier']


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
    """Load sentence-transformers for text embeddings (80MB, very fast)"""
    if models['sentence_model'] is None:
        print("🔄 Loading sentence-transformers (all-MiniLM-L6-v2)...")
        from sentence_transformers import SentenceTransformer
        models['sentence_model'] = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Sentence model loaded")
    return models['sentence_model']


def download_image(url):
    """Download image from URL"""
    try:
        response = http_requests.get(url, timeout=15)
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


def extract_video_frames(video_bytes, max_frames=5):
    """Extract key frames from video using OpenCV"""
    import cv2
    frames = []
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames == 0:
            return frames

        # Sample frames evenly
        interval = max(1, total_frames // max_frames)
        for i in range(0, total_frames, interval):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if ret:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                frames.append(pil_image)
                if len(frames) >= max_frames:
                    break
        cap.release()
    finally:
        os.unlink(tmp_path)

    return frames


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
    """YOLOv8 hazard detection on uploaded image or image file"""
    try:
        image = None

        # Support both URL and direct file upload
        if request.content_type and 'multipart' in request.content_type:
            file = request.files.get('image')
            if file:
                image = Image.open(file.stream).convert('RGB')
        else:
            data = request.json
            image_url = data.get('image_url')
            if not image_url:
                return jsonify({'error': 'image_url or image file is required'}), 400
            image = download_image(image_url)

        if image is None:
            return jsonify({'error': 'Failed to load image'}), 400

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
    """Zero-shot text classification for complaint text"""
    try:
        data = request.json
        text = data.get('text', '')

        if not text:
            return jsonify({'error': 'text is required'}), 400

        classifier = load_text_classifier()

        result = classifier(
            text,
            candidate_labels=BERT_CATEGORIES,
            multi_label=False
        )

        raw_label = result['labels'][0]
        category = LABEL_TO_CATEGORY.get(raw_label, 'other')
        confidence = result['scores'][0]
        severity = classify_severity(text)

        return jsonify({
            'category': category,
            'confidence': round(confidence, 4),
            'severity': severity,
            'all_scores': {
                LABEL_TO_CATEGORY.get(label, label): round(score, 4)
                for label, score in zip(result['labels'][:5], result['scores'][:5])
            }
        })

    except Exception as e:
        print(f"❌ Text classification error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/analyze-complete', methods=['POST'])
def analyze_complete():
    """Complete analysis: image + optional text. Returns everything needed for a complaint.
    Used for image-only mode where AI auto-generates title and description."""
    try:
        image = None
        text = ''

        if request.content_type and 'multipart' in request.content_type:
            file = request.files.get('image')
            text = request.form.get('text', '')
            if file:
                image = Image.open(file.stream).convert('RGB')
        else:
            data = request.json
            image_url = data.get('image_url')
            text = data.get('text', '')
            if image_url:
                image = download_image(image_url)

        result = {
            'detections': [],
            'category': 'other',
            'severity': 'medium',
            'title': 'Civic Issue Reported',
            'description': 'Civic issue detected via image analysis.',
            'confidence': 0,
            'labels': []
        }

        # 1. Image analysis
        if image is not None:
            model = load_yolo()
            yolo_results = model(image, conf=0.25, verbose=False)
            for r in yolo_results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = YOLO_CLASSES[cls_id] if cls_id < len(YOLO_CLASSES) else f'class_{cls_id}'
                    result['detections'].append({
                        'label': label,
                        'confidence': round(conf, 4),
                        'bbox': [round(b, 2) for b in box.xyxy[0].tolist()],
                        'class_id': cls_id
                    })

            if result['detections']:
                top = max(result['detections'], key=lambda d: d['confidence'])
                result['category'] = top['label']
                result['labels'] = list(set(d['label'] for d in result['detections']))
                result['title'] = LABEL_TITLES.get(top['label'], f'{top["label"].replace("_", " ").title()} Detected')
                result['description'] = f"AI detected: {', '.join(result['labels'])}. Highest confidence: {top['label']} ({top['confidence']*100:.1f}%)."
                result['confidence'] = top['confidence']

                # Severity from image confidence
                if top['confidence'] > 0.8:
                    result['severity'] = 'critical'
                elif top['confidence'] > 0.6:
                    result['severity'] = 'high'
                elif top['confidence'] > 0.4:
                    result['severity'] = 'medium'
                else:
                    result['severity'] = 'low'

        # 2. Text classification (if text provided)
        if text:
            classifier = load_text_classifier()
            text_result = classifier(text, candidate_labels=BERT_CATEGORIES, multi_label=False)
            text_category = LABEL_TO_CATEGORY.get(text_result['labels'][0], 'other')
            text_severity = classify_severity(text)

            # If no image detections, use text
            if not result['detections']:
                result['category'] = text_category
                result['severity'] = text_severity
                result['title'] = f'{text_category.replace("_", " ").title()} Issue Reported'
                result['description'] = text
                result['confidence'] = text_result['scores'][0]

            result['text_analysis'] = {
                'category': text_category,
                'severity': text_severity,
                'confidence': round(text_result['scores'][0], 4)
            }

        return jsonify(result)

    except Exception as e:
        print(f"❌ Complete analysis error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/analyze-video', methods=['POST'])
def analyze_video():
    """Analyze video: extract frames, run YOLO on each, aggregate detections"""
    try:
        file = request.files.get('video')
        if not file:
            return jsonify({'error': 'video file is required'}), 400

        video_bytes = file.read()
        frames = extract_video_frames(video_bytes, max_frames=5)

        if not frames:
            return jsonify({'error': 'Could not extract frames from video'}), 400

        model = load_yolo()
        all_detections = []
        frame_results = []

        for i, frame in enumerate(frames):
            results = model(frame, conf=0.25, verbose=False)
            frame_dets = []
            for r in results:
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    label = YOLO_CLASSES[cls_id] if cls_id < len(YOLO_CLASSES) else f'class_{cls_id}'
                    det = {'label': label, 'confidence': round(conf, 4), 'class_id': cls_id}
                    frame_dets.append(det)
                    all_detections.append(det)

            frame_results.append({'frame_index': i, 'detections': frame_dets})

        # Aggregate: find most frequently detected labels
        label_counts = {}
        label_max_conf = {}
        for d in all_detections:
            label_counts[d['label']] = label_counts.get(d['label'], 0) + 1
            label_max_conf[d['label']] = max(label_max_conf.get(d['label'], 0), d['confidence'])

        top_label = max(label_counts, key=label_counts.get) if label_counts else None

        return jsonify({
            'frames_analyzed': len(frames),
            'frame_results': frame_results,
            'aggregated': {
                'top_label': top_label,
                'label_counts': label_counts,
                'label_max_confidence': label_max_conf,
                'total_detections': len(all_detections),
                'title': LABEL_TITLES.get(top_label, 'Civic Issue Detected') if top_label else 'No Issues Detected',
                'severity': 'high' if (top_label and label_max_conf.get(top_label, 0) > 0.6) else 'medium'
            }
        })

    except Exception as e:
        print(f"❌ Video analysis error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/ml/embed', methods=['POST'])
def generate_embeddings():
    """Generate embeddings for duplicate detection"""
    try:
        data = request.json
        text = data.get('text', '')
        image_url = data.get('image_url')

        result = {}

        # Text embedding (sentence-transformers — very fast, 80MB)
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
║       YOLO auto-install: DISABLED       ║
╚══════════════════════════════════════════╝
    """)

    app.run(host='0.0.0.0', port=port, debug=debug)
