"""
CivicPulse — Smart Re-labeler for Custom Training Images
Uses YOLO-World zero-shot detection with multi-prompt, quadrant-splitting, 
and confidence-tiered fallback to produce accurate bounding boxes.

This ONLY re-labels custom_real_* images (added via download_additional_data.py).
Original Kaggle labels are NOT touched.

Usage:
    python smart_relabel.py              # Re-label all custom images
    python smart_relabel.py --dry-run    # Preview what would change
"""

import os
import sys
import glob
import argparse
from PIL import Image
import numpy as np

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

# Multi-prompt strategy: multiple prompts per category, ordered by specificity
CATEGORY_PROMPTS = {
    'DeadAnimalsPollution': [
        ['dead animal on road', 'roadkill', 'dead bird', 'dead cat', 'dead dog', 'animal carcass'],
        ['animal body', 'animal lying on ground', 'deceased animal'],
        ['dead creature', 'animal remains'],
    ],
    'DamagedElectricalPoles': [
        ['damaged electric pole', 'broken power pole', 'fallen electric pole', 'tilted utility pole'],
        ['tangled electric wires', 'hanging power cable', 'exposed electrical wire', 'wire mess on pole'],
        ['electric pole', 'utility pole', 'power line pole', 'telephone pole'],
    ],
}


def load_yoloworld(device='cpu'):
    """Load YOLO-World model for zero-shot detection."""
    try:
        from ultralytics import YOLOWorld
        model = YOLOWorld("yolov8s-world.pt")
        print(f"  ✅ YOLO-World loaded (device: {device})")
        return model
    except Exception as e:
        print(f"  ❌ Failed to load YOLO-World: {e}")
        return None


def detect_with_prompts(model, img_path, prompt_sets, device='cpu', conf_threshold=0.03):
    """
    Try multiple prompt sets on an image. Return the best detection found.
    Returns: (best_bbox_xywhn, confidence) or (None, 0)
    """
    best_box = None
    best_conf = 0.0

    for prompts in prompt_sets:
        try:
            model.set_classes(prompts)
            results = model.predict(img_path, conf=conf_threshold, verbose=False, device=device)
            boxes = results[0].boxes

            if len(boxes) > 0:
                # Get the highest confidence box
                for i in range(len(boxes)):
                    conf = float(boxes[i].conf[0])
                    if conf > best_conf:
                        best_conf = conf
                        best_box = boxes[i].xywhn[0].tolist()
        except Exception as e:
            continue

    return best_box, best_conf


def detect_quadrants(model, img_path, prompt_sets, device='cpu'):
    """
    Split image into 4 overlapping quadrants and run detection on each.
    This catches objects at corners/edges that full-image detection misses.
    Returns: (best_bbox_xywhn_in_full_image, confidence) or (None, 0)
    """
    try:
        img = Image.open(img_path).convert('RGB')
    except Exception:
        return None, 0

    w, h = img.size
    best_box = None
    best_conf = 0.0

    # 4 overlapping quadrants (50% overlap)
    quadrants = [
        (0, 0, int(w * 0.6), int(h * 0.6)),           # top-left
        (int(w * 0.4), 0, w, int(h * 0.6)),            # top-right
        (0, int(h * 0.4), int(w * 0.6), h),            # bottom-left
        (int(w * 0.4), int(h * 0.4), w, h),            # bottom-right
        (int(w * 0.15), int(h * 0.15), int(w * 0.85), int(h * 0.85)),  # center crop
    ]

    for qi, (x1, y1, x2, y2) in enumerate(quadrants):
        crop = img.crop((x1, y1, x2, y2))
        # Save temp crop
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            crop.save(tmp.name, 'JPEG')
            tmp_path = tmp.name

        try:
            box, conf = detect_with_prompts(model, tmp_path, prompt_sets, device=device, conf_threshold=0.02)
            if box is not None and conf > best_conf:
                # Convert quadrant-relative coords to full-image coords
                qw = x2 - x1
                qh = y2 - y1
                cx_full = (x1 + box[0] * qw) / w
                cy_full = (y1 + box[1] * qh) / h
                bw_full = (box[2] * qw) / w
                bh_full = (box[3] * qh) / h

                # Clip to valid range
                cx_full = max(0.01, min(0.99, cx_full))
                cy_full = max(0.01, min(0.99, cy_full))
                bw_full = max(0.05, min(0.98, bw_full))
                bh_full = max(0.05, min(0.98, bh_full))

                best_box = [cx_full, cy_full, bw_full, bh_full]
                best_conf = conf
        finally:
            os.unlink(tmp_path)

    return best_box, best_conf


def create_adaptive_box(img_path):
    """
    When all detection fails, create an adaptive box based on image content.
    Uses edge detection to find the region of interest instead of a dumb center box.
    Falls back to 80% coverage box (better than 90% center).
    """
    try:
        import cv2
        img = cv2.imread(img_path)
        if img is None:
            return [0.5, 0.5, 0.8, 0.8]

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Apply edge detection
        edges = cv2.Canny(gray, 50, 150)
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            # Get the largest contour
            largest = max(contours, key=cv2.contourArea)
            x, y, cw, ch = cv2.boundingRect(largest)
            h, w = img.shape[:2]

            # If the contour is reasonable (not too small, not the whole image)
            area_ratio = (cw * ch) / (w * h)
            if 0.02 < area_ratio < 0.9:
                cx = (x + cw / 2) / w
                cy = (y + ch / 2) / h
                bw = min(cw * 1.3 / w, 0.95)  # Add 30% padding
                bh = min(ch * 1.3 / h, 0.95)
                return [
                    max(0.05, min(0.95, cx)),
                    max(0.05, min(0.95, cy)),
                    max(0.1, bw),
                    max(0.1, bh)
                ]
    except ImportError:
        pass
    except Exception:
        pass

    # Final fallback: 80% box (slightly better than 90% center)
    return [0.5, 0.5, 0.8, 0.8]


def smart_relabel(args):
    """Main re-labeling pipeline."""
    print("\n" + "=" * 60)
    print("  CivicPulse Smart Re-labeler")
    print("  Only re-labels custom_real_* images")
    print("=" * 60)

    device = args.device
    model = load_yoloworld(device)
    if model is None:
        print("Cannot proceed without YOLO-World model.")
        return False

    stats = {
        'total': 0,
        'yolo_detected': 0,
        'quadrant_detected': 0,
        'adaptive_box': 0,
        'fallback_box': 0,
        'skipped': 0,
    }

    for category, prompt_sets in CATEGORY_PROMPTS.items():
        img_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'images')
        lbl_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'labels')

        if not os.path.exists(img_dir):
            print(f"\n⚠️ Image dir not found: {img_dir}")
            continue

        # Only re-label custom images
        custom_images = sorted(glob.glob(os.path.join(img_dir, 'custom_real_*.*')))
        print(f"\n📂 {category}: {len(custom_images)} custom images to re-label")

        for img_path in custom_images:
            stats['total'] += 1
            base_name = os.path.basename(img_path)
            label_name = os.path.splitext(base_name)[0] + '.txt'
            label_path = os.path.join(lbl_dir, label_name)

            # Verify image is valid
            try:
                img = Image.open(img_path)
                img.verify()
            except Exception:
                print(f"  ⚠️ Invalid image, skipping: {base_name}")
                stats['skipped'] += 1
                continue

            # TIER 1: Full-image multi-prompt detection
            box, conf = detect_with_prompts(model, img_path, prompt_sets, device=device)

            if box is not None and conf >= 0.08:
                method = 'yolo_detected'
                stats['yolo_detected'] += 1
                label_line = f"0 {box[0]:.6f} {box[1]:.6f} {box[2]:.6f} {box[3]:.6f}\n"
                if not args.dry_run:
                    with open(label_path, 'w') as f:
                        f.write(label_line)
                print(f"  ✅ {base_name}: YOLO detected (conf={conf:.3f}) → [{box[0]:.2f}, {box[1]:.2f}, {box[2]:.2f}, {box[3]:.2f}]")
                continue

            # TIER 2: Quadrant-based detection (catches corner objects)
            box, conf = detect_quadrants(model, img_path, prompt_sets, device=device)

            if box is not None and conf >= 0.05:
                method = 'quadrant_detected'
                stats['quadrant_detected'] += 1
                label_line = f"0 {box[0]:.6f} {box[1]:.6f} {box[2]:.6f} {box[3]:.6f}\n"
                if not args.dry_run:
                    with open(label_path, 'w') as f:
                        f.write(label_line)
                print(f"  🔍 {base_name}: Quadrant detected (conf={conf:.3f}) → [{box[0]:.2f}, {box[1]:.2f}, {box[2]:.2f}, {box[3]:.2f}]")
                continue

            # TIER 3: Adaptive edge-based box
            box = create_adaptive_box(img_path)
            stats['adaptive_box'] += 1
            label_line = f"0 {box[0]:.6f} {box[1]:.6f} {box[2]:.6f} {box[3]:.6f}\n"
            if not args.dry_run:
                with open(label_path, 'w') as f:
                    f.write(label_line)
            print(f"  📐 {base_name}: Adaptive box → [{box[0]:.2f}, {box[1]:.2f}, {box[2]:.2f}, {box[3]:.2f}]")

    # Summary
    print("\n" + "=" * 60)
    print("  Re-labeling Summary")
    print("=" * 60)
    print(f"  Total images processed:  {stats['total']}")
    print(f"  ✅ YOLO detected:        {stats['yolo_detected']}")
    print(f"  🔍 Quadrant detected:    {stats['quadrant_detected']}")
    print(f"  📐 Adaptive box:         {stats['adaptive_box']}")
    print(f"  ⚠️  Skipped (invalid):    {stats['skipped']}")

    accuracy = (stats['yolo_detected'] + stats['quadrant_detected']) / max(stats['total'], 1) * 100
    print(f"\n  Detection rate: {accuracy:.1f}% ({stats['yolo_detected'] + stats['quadrant_detected']}/{stats['total']})")

    if args.dry_run:
        print("\n  ℹ️  DRY RUN — no files were modified.")

    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Smart re-labeler for custom training images')
    parser.add_argument('--device', default='0', help='Device: cpu or 0 for GPU')
    parser.add_argument('--dry-run', action='store_true', help='Preview only, no file changes')
    args = parser.parse_args()
    
    success = smart_relabel(args)
    sys.exit(0 if success else 1)
