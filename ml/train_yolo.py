"""
CivicPulse  YOLO Fine-Tuning on Kaggle Urban Issues Dataset
Handles the nested ClassName/ClassName/split/images structure,
preserves the original Kaggle 0-9 class IDs, and trains with augmentation.

Optimized for RTX 3050 Laptop GPU (4GB VRAM):
  - batch=8, amp=True (FP16), cache='disk'
  - 80 epochs with patience=20 for convergence
  - Uses ALL available images for maximum accuracy

Usage:
    python train_yolo.py                          # Full training (80 epochs, yolo11n, ALL data)
    python train_yolo.py --model yolo11m.pt        # Use YOLOv11m instead
    python train_yolo.py --epochs 5 --dry-run      # Quick test
    python train_yolo.py --max_per_class 500       # Cap per class (for quick experiments)
"""

import os
import sys
import shutil
import glob
import argparse
import yaml

# ============================================================
# Configuration
# ============================================================

# Root of the project (parent of ml/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.dirname(os.path.abspath(__file__))

# Where the kaggle dataset was extracted
KAGGLE_DATA_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

# Where we'll prepare the unified YOLO dataset
PREPARED_DIR = os.path.join(ML_DIR, 'data', 'prepared')

# Where best model is saved
OUTPUT_MODEL_DIR = os.path.join(ML_DIR, 'models', 'yolo-urban')

# The 10 Kaggle Urban Issues classes (order matches config.yaml)
# Each folder in the dataset corresponds to one of these classes
# Class IDs 0-9 are ALREADY correctly assigned in the Kaggle label files.
CLASSES = [
    'Damaged Road issues',            # 0
    'Pothole Issues',                 # 1
    'Illegal Parking Issues',         # 2
    'Broken Road Sign Issues',        # 3
    'Fallen trees',                   # 4
    'Littering/Garbage on Public Places',  # 5
    'Vandalism Issues',               # 6
    'Dead Animal Pollution',          # 7
    'Damaged concrete structures',    # 8
    'Damaged Electric wires and poles',  # 9
]

# Mapping from dataset folder names  the EXPECTED class IDs in that folder's labels.
# Instead of remapping, we PRESERVE the original Kaggle class IDs.
# The label files already contain the correct class IDs (0-9).
# We just need to know which folders to process.
DATASET_FOLDERS = [
    'Potholes and RoadCracks',       # contains class 0 (damaged road) + class 1 (pothole)
    'IllegalParking',                 # contains class 2
    'DamagedRoadSigns',              # contains class 3
    'FallenTrees',                    # contains class 4
    'Garbage',                        # contains class 5
    'Graffitti',                      # contains class 6
    'DeadAnimalsPollution',          # contains class 7
    'Damaged concrete structures',    # contains class 8
    'DamagedElectricalPoles',        # contains class 9
]

VALID_CLASS_IDS = set(range(10))  # 09


def clean_prepared_dir():
    """Remove and recreate the prepared data directory.
    Handles Windows PermissionError from locked files (YOLO cache, Explorer, etc.)."""
    import gc, time, stat

    def force_remove(func, path, exc_info):
        """Error handler for shutil.rmtree  force-remove read-only or locked files."""
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass  # Skip files we truly can't delete

    if os.path.exists(PREPARED_DIR):
        print(f"Cleaning existing prepared data: {PREPARED_DIR}")
        gc.collect()
        try:
            shutil.rmtree(PREPARED_DIR, onerror=force_remove)
        except Exception:
            # Fallback: Windows rmdir
            os.system(f'rmdir /s /q "{PREPARED_DIR}" 2>nul')
            time.sleep(1)
        if os.path.exists(PREPARED_DIR):
            # Last resort: try once more after a pause
            time.sleep(2)
            try:
                shutil.rmtree(PREPARED_DIR, onerror=force_remove)
            except Exception:
                print("  WARNING: Could not fully clean directory, will overwrite files")

    for split in ['train', 'valid', 'test']:
        os.makedirs(os.path.join(PREPARED_DIR, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(PREPARED_DIR, 'labels', split), exist_ok=True)

    print("Created prepared data directories")


def clean_label_line(line):
    """Clean and validate a YOLO label line.
    Handles BOTH formats:
      - Detection:    class_id cx cy w h           (5 values)
      - Segmentation: class_id x1 y1 x2 y2 ... xn yn  (polygon points)
    
    Segmentation labels are auto-converted to bounding boxes (cx, cy, w, h).
    Strips BOM characters and validates class ID is in range 0-9.
    Returns (class_id, detection_format_line) if valid, None otherwise."""
    # Strip BOM (\ufeff) that appears in some label files (e.g. DeadAnimalsPollution)
    cleaned = line.strip().replace('\ufeff', '').replace('\xef\xbb\xbf', '')
    if not cleaned:
        return None
    parts = cleaned.split()
    if len(parts) < 5:
        return None
    try:
        class_id = int(parts[0])
        if class_id not in VALID_CLASS_IDS:
            return None

        coords = [float(p) for p in parts[1:]]

        # Validate all coordinates are in [0, 1] range
        if any(v < 0.0 or v > 1.0 for v in coords):
            return None

        if len(parts) == 5:
            # Standard detection format: class_id cx cy w h
            return (class_id, cleaned)
        elif len(coords) >= 4 and len(coords) % 2 == 0:
            # Segmentation/polygon format: convert polygon to bounding box
            xs = coords[0::2]  # x coordinates (even indices)
            ys = coords[1::2]  # y coordinates (odd indices)
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)
            cx = (x_min + x_max) / 2.0
            cy = (y_min + y_max) / 2.0
            w = x_max - x_min
            h = y_max - y_min
            if w > 0.001 and h > 0.001:  # Skip degenerate boxes
                det_line = f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
                return (class_id, det_line)
            return None
        else:
            return None
    except ValueError:
        return None


def prepare_dataset(max_per_class=None):
    """
    Flatten the nested Kaggle dataset into a unified YOLO format.
    
    The Kaggle dataset has the structure:
        kaggle_archive/
          ClassName/
            ClassName/            nested duplicate folder
              train/
                images/*.jpg
                labels/*.txt
              valid/
                images/*.jpg
                labels/*.txt
              test/
                images/*.jpg
                labels/*.txt
    
    We flatten this into:
        ml/data/prepared/
          images/train/*.jpg
          labels/train/*.txt
          images/valid/*.jpg
          labels/valid/*.txt
          images/test/*.jpg
          labels/test/*.txt
    
    IMPORTANT: Labels are PRESERVED as-is from the Kaggle dataset.
    The Kaggle labels already use the correct class IDs (0-9).
    We only clean BOM characters, validate format, and filter out-of-range IDs.
    """
    import random
    
    if not os.path.exists(KAGGLE_DATA_DIR):
        print(f" Kaggle dataset not found at: {KAGGLE_DATA_DIR}")
        print("   Please extract the dataset to this directory.")
        return False
    
    clean_prepared_dir()
    
    total_images = 0
    total_labels = 0
    total_annotations = 0
    skipped_lines = 0
    bom_fixed = 0
    class_annotation_counts = {}  # Track per-class annotation counts
    class_image_counts = {}      # Track per-class image counts
    
    # Process each folder in the dataset
    for folder_name in DATASET_FOLDERS:
        folder_path = os.path.join(KAGGLE_DATA_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            print(f"  Folder not found, skipping: {folder_name}")
            continue
        
        # Handle nested folder: ClassName/ClassName/
        nested_path = os.path.join(folder_path, folder_name)
        if os.path.exists(nested_path):
            data_path = nested_path
        else:
            data_path = folder_path
        
        print(f"Processing: {folder_name}")
        
        for split in ['train', 'valid', 'test']:
            images_dir = os.path.join(data_path, split, 'images')
            labels_dir = os.path.join(data_path, split, 'labels')
            
            if not os.path.exists(images_dir):
                continue
            
            image_files = glob.glob(os.path.join(images_dir, '*'))
            valid_images = [f for f in image_files 
                          if os.path.splitext(f)[1].lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']]
            
            # Optional per-class cap for quick experiments
            if max_per_class is not None and max_per_class < len(valid_images):
                random.seed(42)  # Reproducible subsets
                random.shuffle(valid_images)
                if split == 'train':
                    valid_images = valid_images[:max_per_class]
                elif split == 'valid':
                    valid_images = valid_images[:max(20, max_per_class // 4)]
                elif split == 'test':
                    valid_images = valid_images[:max(20, max_per_class // 5)]
            
            for img_path in valid_images:
                img_name = os.path.basename(img_path)
                # Use unique prefixed name to avoid collisions between folders
                unique_name = f"{folder_name}_{img_name}"
                
                # Process corresponding label FIRST  skip images with invalid/empty labels
                label_name = os.path.splitext(img_name)[0] + '.txt'
                label_path = os.path.join(labels_dir, label_name)
                dest_label = os.path.join(PREPARED_DIR, 'labels', split, f"{folder_name}_{label_name}")
                
                has_valid_label = False
                if os.path.exists(label_path):
                    with open(label_path, 'r', encoding='utf-8-sig') as f:
                        raw_lines = f.readlines()
                    
                    valid_lines = []
                    for line in raw_lines:
                        # Check for BOM and count fixes
                        if '\ufeff' in line:
                            bom_fixed += 1
                        
                        result = clean_label_line(line)
                        if result is None:
                            skipped_lines += 1
                            continue
                        
                        class_id, cleaned_line = result
                        valid_lines.append(cleaned_line + '\n')
                        class_annotation_counts[class_id] = class_annotation_counts.get(class_id, 0) + 1
                        total_annotations += 1
                    
                    if valid_lines:
                        with open(dest_label, 'w') as f:
                            f.writelines(valid_lines)
                        has_valid_label = True
                        total_labels += 1
                
                # Copy the image (even if label is empty  YOLO treats that as background)
                dest_img = os.path.join(PREPARED_DIR, 'images', split, unique_name)
                shutil.copy2(img_path, dest_img)
                total_images += 1
                
                if has_valid_label:
                    # Track which classes this folder contributed to
                    for line in valid_lines:
                        cid = int(line.strip().split()[0])
                        class_image_counts[cid] = class_image_counts.get(cid, 0) + 1
    
    # Report
    print(f"\n{'='*60}")
    print(f"Dataset prepared successfully!")
    print(f"{'='*60}")
    print(f"   Total images: {total_images}")
    print(f"   Label files with valid annotations: {total_labels}")
    print(f"   Total annotations: {total_annotations}")
    print(f"   Skipped invalid label lines: {skipped_lines}")
    print(f"   BOM characters fixed: {bom_fixed}")
    
    for split in ['train', 'valid', 'test']:
        n_imgs = len(os.listdir(os.path.join(PREPARED_DIR, 'images', split)))
        n_lbls = len(os.listdir(os.path.join(PREPARED_DIR, 'labels', split)))
        print(f"   {split}: {n_imgs} images, {n_lbls} labels")
    
    # Class balance report (based on ANNOTATIONS, not images)
    print(f"\nClass annotation distribution:")
    missing_classes = []
    for cls_id in range(10):
        count = class_annotation_counts.get(cls_id, 0)
        cls_name = CLASSES[cls_id] if cls_id < len(CLASSES) else f'class_{cls_id}'
        bar = '#' * min(count // 100, 50)
        status = '[OK]' if count > 0 else '[MISSING]'
        print(f"   [{cls_id}] {cls_name:40} : {count:5d} {bar} {status}")
        if count == 0:
            missing_classes.append(cls_id)
    
    if missing_classes:
        print(f"\n WARNING: Classes with ZERO annotations: {missing_classes}")
        print(f"   The model will not learn these classes!")
    else:
        print(f"\n All 10 classes have annotations!")
    
    return total_images > 0


def create_data_yaml():
    """Create the data.yaml config file for YOLO training."""
    data_config = {
        'path': PREPARED_DIR.replace('\\', '/'),
        'train': 'images/train',
        'val': 'images/valid',
        'test': 'images/test',
        'nc': len(CLASSES),
        'names': CLASSES,
    }
    
    yaml_path = os.path.join(PREPARED_DIR, 'data.yaml')
    with open(yaml_path, 'w') as f:
        yaml.dump(data_config, f, default_flow_style=False, sort_keys=False)
    
    print(f" Created data.yaml at: {yaml_path}")
    return yaml_path


def train_yolo(args):
    """Fine-tune YOLOv11n on the prepared dataset."""
    
    # Step 1: Prepare dataset
    print("\n" + "=" * 60)
    print("STEP 1: Preparing Dataset")
    print("=" * 60 + "\n")
    
    if not prepare_dataset(max_per_class=args.max_per_class):
        print(" Dataset preparation failed. Exiting.")
        return False
    
    # Step 2: Create data.yaml
    yaml_path = create_data_yaml()
    
    if args.dry_run:
        print("\nDry-run complete -- dataset prepared successfully.")
        print("   Run without --dry-run to start training.")
        return True
    
    # Step 3: Train
    print("\n" + "=" * 60)
    print("STEP 2: Training YOLO")
    print("=" * 60 + "\n")
    
    from ultralytics import YOLO
    
    # Model selection: YOLOv11n (best for 4GB VRAM), YOLOv11s, or best.pt for fine-tuning
    model_file = args.model
    last_ckpt = os.path.join(ML_DIR, 'runs', 'yolo-urban', 'weights', 'last.pt')
    best_deployed = os.path.join(ML_DIR, 'models', 'yolo-urban', 'best.pt')
    
    if args.fine_tune and os.path.exists(best_deployed):
        print(f" Fine-tuning mode enabled. Loading best weights from: {best_deployed}")
        model = YOLO(best_deployed)
    elif args.resume and os.path.exists(last_ckpt):
        print(f"Resuming from checkpoint: {last_ckpt}")
        model = YOLO(last_ckpt)
    else:
        # Check for model in ML_DIR first, then let ultralytics download
        local_model = os.path.join(ML_DIR, model_file)
        if os.path.exists(local_model):
            print(f"Loading {model_file} from local: {local_model}")
            model = YOLO(local_model)
        else:
            print(f"Loading {model_file} (will download if needed)...")
            model = YOLO(model_file)
    
    # ========================================
    # Augmentation config  tuned for accuracy
    # ========================================
    augmentation = {
        'hsv_h': 0.015,     # Hue augmentation
        'hsv_s': 0.7,       # Saturation augmentation
        'hsv_v': 0.4,       # Value augmentation
        'translate': 0.1,   # Translation (+/- 10%)
        'scale': 0.5,       # Scale (+/- 50%)  helps detect objects at different sizes
        'fliplr': 0.5,      # Horizontal flip  catches corner objects
        'flipud': 0.1,      # Vertical flip (low prob for urban scenes)
        'mosaic': 1.0,      # Mosaic augmentation  CRITICAL for small dataset classes
        'mixup': 0.15,      # MixUp augmentation  improves generalization
        'degrees': 5.0,     # Small rotation for robustness
        'shear': 2.0,       # Small shear
        'perspective': 0.0001,  # Very slight perspective
    }
    
    # ========================================
    # RTX 3050 4GB VRAM Optimization Notes:
    #   batch=8    : fits 640px images in 4GB with FP16
    #   amp=True   : FP16 mixed precision, halves VRAM, 30-40% faster
    #   cache=disk : caches preprocessed images, faster data loading
    #   workers=2  : Windows-safe, avoids multiprocessing issues
    # ========================================
    
    print(f"\nStarting training (RTX 3050 4GB optimized):")
    print(f"   Model: {model_file}")
    print(f"   Epochs: {args.epochs}")
    print(f"   Image size: {args.imgsz}")
    print(f"   Batch size: {args.batch}")
    print(f"   AMP (FP16): True")
    print(f"   Cache: disk")
    print(f"   Device: {'cuda' if args.device == '0' else 'cpu'}")
    print(f"   Data: {yaml_path}")
    print()
    
    results = model.train(
        data=yaml_path,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=16 if args.batch > 16 else args.batch, # High performance cap for 4GB VRAM
        device=args.device,
        patience=20,           # More patience  don't stop early on noisy loss
        save=True,
        save_period=10,        # Save checkpoint every 10 epochs
        project=os.path.join(ML_DIR, 'runs'),
        name='yolo-urban',
        exist_ok=True,
        pretrained=True,
        optimizer='AdamW',
        lr0=0.001 if args.fine_tune else 0.01, # Lower LR for fine-tuning
        lrf=0.01,              # Final LR fraction
        warmup_epochs=0 if args.fine_tune else 5, # Skip warmup for fine-tuning
        cos_lr=True,           # Cosine LR schedule
        cls=2.0,               # Boost classification loss weight
        box=7.5,               # Standard box loss weight
        verbose=True,
        workers=2,             # High performance data loading (safe for Windows)
        close_mosaic=15,       # Disable mosaic for last 15 epochs (finer detail learning)
        amp=True,              # FP16 mixed precision
        cache='disk',          # Cache images to disk for faster data loading
        # Augmentation parameters
        **augmentation,
    )
    
    # Step 4: Copy best model to deployment location
    print("\n" + "=" * 60)
    print("STEP 3: Deploying Best Model")
    print("=" * 60 + "\n")
    
    run_dir = os.path.join(ML_DIR, 'runs', 'yolo-urban')
    best_pt = os.path.join(run_dir, 'weights', 'best.pt')
    
    if os.path.exists(best_pt):
        os.makedirs(OUTPUT_MODEL_DIR, exist_ok=True)
        dest_pt = os.path.join(OUTPUT_MODEL_DIR, 'best.pt')
        shutil.copy2(best_pt, dest_pt)
        print(f"Best model deployed to: {dest_pt}")
        print(f"   The ML service will auto-load this model on next restart.")
    else:
        # Try last.pt as fallback
        last_pt = os.path.join(run_dir, 'weights', 'last.pt')
        if os.path.exists(last_pt):
            os.makedirs(OUTPUT_MODEL_DIR, exist_ok=True)
            dest_pt = os.path.join(OUTPUT_MODEL_DIR, 'best.pt')
            shutil.copy2(last_pt, dest_pt)
            print(f" Last model deployed to: {dest_pt}")
        else:
            print("  No model weights found in training output.")
            return False
    
    print("\n YOLO training complete!")
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train YOLO on Urban Issues Dataset')
    parser.add_argument('--model', type=str, default='yolo11n.pt', help='YOLO model file (default: yolo11n.pt)')
    parser.add_argument('--epochs', type=int, default=80, help='Training epochs (default: 80)')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size (default: 640 for best accuracy)')
    parser.add_argument('--batch', type=int, default=8, help='Batch size (default: 8 for RTX 3050 4GB)')
    parser.add_argument('--device', type=str, default='0', help='Device: cpu or 0 for GPU')
    parser.add_argument('--max_per_class', type=int, default=None, help='Max images per class per split (default: None = use ALL images)')
    parser.add_argument('--resume', action='store_true', help='Resume from last checkpoint')
    parser.add_argument('--fine-tune', action='store_true', help='Fine-tune from best.pt with lower LR and fewer epochs')
    parser.add_argument('--dry-run', action='store_true', help='Only prepare dataset, skip training')
    
    args = parser.parse_args()
    
    success = train_yolo(args)
    sys.exit(0 if success else 1)
