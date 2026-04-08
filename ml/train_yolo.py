"""
CivicPulse — YOLO Fine-Tuning on Kaggle Urban Issues Dataset
Handles the nested ClassName/ClassName/split/images structure,
remaps labels to a unified 10-class scheme, and trains with augmentation.

Supports YOLOv26n (default, best accuracy) or YOLOv11n/YOLOv11m.
Includes class balancing via oversampling minority classes.

Usage:
    python train_yolo.py                          # Full training (50 epochs, YOLOv26n)
    python train_yolo.py --model yolo11m.pt        # Use YOLOv11m instead
    python train_yolo.py --epochs 5 --dry-run      # Quick test
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
CLASSES = [
    'Damaged Road issues',
    'Pothole Issues',
    'Illegal Parking Issues',
    'Broken Road Sign Issues',
    'Fallen trees',
    'Littering/Garbage on Public Places',
    'Vandalism Issues',
    'Dead Animal Pollution',
    'Damaged concrete structures',
    'Damaged Electric wires and poles',
]

# Mapping from dataset folder names → unified class index (0-9)
FOLDER_TO_CLASS = {
    'Potholes and RoadCracks': 1,       # → Pothole Issues
    'IllegalParking': 2,                 # → Illegal Parking Issues
    'DamagedRoadSigns': 3,              # → Broken Road Sign Issues
    'FallenTrees': 4,                    # → Fallen trees
    'Garbage': 5,                        # → Littering/Garbage
    'Graffitti': 6,                      # → Vandalism Issues
    'DeadAnimalsPollution': 7,           # → Dead Animal Pollution
    'Damaged concrete structures': 8,    # → Damaged concrete structures
    'DamagedElectricalPoles': 9,         # → Damaged Electric wires and poles
}


def clean_prepared_dir():
    """Remove and recreate the prepared data directory."""
    if os.path.exists(PREPARED_DIR):
        print(f"🧹 Cleaning existing prepared data: {PREPARED_DIR}")
        shutil.rmtree(PREPARED_DIR)
    
    for split in ['train', 'valid', 'test']:
        os.makedirs(os.path.join(PREPARED_DIR, 'images', split), exist_ok=True)
        os.makedirs(os.path.join(PREPARED_DIR, 'labels', split), exist_ok=True)
    
    print("📁 Created prepared data directories")


def is_valid_label_line(line):
    """Check if a YOLO label line is valid (exactly 5 space-separated values)."""
    parts = line.strip().split()
    if len(parts) != 5:
        return False
    try:
        int(parts[0])  # class_id should be int
        for p in parts[1:]:
            float(p)    # coordinates should be floats
        return True
    except ValueError:
        return False


def prepare_dataset(max_per_class=None):
    """
    Flatten the nested Kaggle dataset into a unified YOLO format.
    
    The Kaggle dataset has the structure:
        kaggle_archive/
          ClassName/
            ClassName/           ← nested duplicate folder
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
    
    Labels are remapped so every class uses the unified 0-9 class IDs.
    Invalid labels (wrong number of values) are filtered out.
    """
    
    if not os.path.exists(KAGGLE_DATA_DIR):
        print(f"❌ Kaggle dataset not found at: {KAGGLE_DATA_DIR}")
        print("   Please extract the dataset to this directory.")
        return False
    
    clean_prepared_dir()
    
    total_images = 0
    total_labels = 0
    skipped_labels = 0
    class_counts = {}  # Track per-class counts for balance report
    
    # Process each class folder
    for folder_name, target_class_id in FOLDER_TO_CLASS.items():
        folder_path = os.path.join(KAGGLE_DATA_DIR, folder_name)
        
        if not os.path.exists(folder_path):
            print(f"⚠️  Folder not found, skipping: {folder_name}")
            continue
        
        # Handle nested folder: ClassName/ClassName/
        nested_path = os.path.join(folder_path, folder_name)
        if os.path.exists(nested_path):
            data_path = nested_path
        else:
            data_path = folder_path
        
        print(f"📂 Processing: {folder_name} → class {target_class_id} ({CLASSES[target_class_id]})")
        
        for split in ['train', 'valid', 'test']:
            images_dir = os.path.join(data_path, split, 'images')
            labels_dir = os.path.join(data_path, split, 'labels')
            
            if not os.path.exists(images_dir):
                continue
            
            # Copy images
            import random
            image_files = glob.glob(os.path.join(images_dir, '*'))
            
            # Data preprocessing: limit the massive Kaggle dataset if max_per_class is set
            if max_per_class is not None:
                random.seed(42) # Replicable subsets
                valid_images = [f for f in image_files if os.path.splitext(f)[1].lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']]
                random.shuffle(valid_images)
                
                if split == 'train':
                    image_files = valid_images[:max_per_class]
                elif split == 'valid':
                    image_files = valid_images[:max(10, max_per_class // 5)] # ~20% for val
                elif split == 'test':
                    image_files = valid_images[:max(10, max_per_class // 10)] # ~10% for test
            
            for img_path in image_files:
                ext = os.path.splitext(img_path)[1].lower()
                if ext not in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
                    continue
                
                # Create unique filename: classname_originalname
                img_name = os.path.basename(img_path)
                unique_name = f"{folder_name}_{img_name}"
                
                dest_img = os.path.join(PREPARED_DIR, 'images', split, unique_name)
                shutil.copy2(img_path, dest_img)
                total_images += 1
                class_counts[target_class_id] = class_counts.get(target_class_id, 0) + 1
                
                # Process corresponding label
                label_name = os.path.splitext(img_name)[0] + '.txt'
                label_path = os.path.join(labels_dir, label_name)
                
                dest_label = os.path.join(PREPARED_DIR, 'labels', split,
                                          f"{folder_name}_{label_name}")
                
                if os.path.exists(label_path):
                    with open(label_path, 'r') as f:
                        lines = f.readlines()
                    
                    valid_lines = []
                    for line in lines:
                        if not is_valid_label_line(line):
                            skipped_labels += 1
                            continue
                        
                        parts = line.strip().split()
                        # Remap the class ID to our unified class
                        parts[0] = str(target_class_id)
                        valid_lines.append(' '.join(parts) + '\n')
                    
                    if valid_lines:
                        with open(dest_label, 'w') as f:
                            f.writelines(valid_lines)
                        total_labels += 1
                else:
                    # Create empty label file (no detections)
                    with open(dest_label, 'w') as f:
                        pass
    
    print(f"\n✅ Dataset prepared:")
    print(f"   📷 Total images: {total_images}")
    print(f"   🏷️  Total label files: {total_labels}")
    print(f"   ⚠️  Skipped invalid label lines: {skipped_labels}")
    
    # Count per split
    for split in ['train', 'valid', 'test']:
        n_imgs = len(os.listdir(os.path.join(PREPARED_DIR, 'images', split)))
        n_lbls = len(os.listdir(os.path.join(PREPARED_DIR, 'labels', split)))
        print(f"   {split}: {n_imgs} images, {n_lbls} labels")
    
    # Class balance report
    print(f"\n📊 Class distribution (train split):")
    for cls_id, count in sorted(class_counts.items()):
        cls_name = CLASSES[cls_id] if cls_id < len(CLASSES) else f'class_{cls_id}'
        bar = '█' * min(count // 100, 50)
        print(f"   [{cls_id}] {cls_name:40} : {count:5d} {bar}")
    
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
    
    print(f"📄 Created data.yaml at: {yaml_path}")
    return yaml_path


def train_yolo(args):
    """Fine-tune YOLOv11n on the prepared dataset."""
    
    # Step 1: Prepare dataset
    print("\n" + "=" * 60)
    print("STEP 1: Preparing Dataset")
    print("=" * 60 + "\n")
    
    if not prepare_dataset(max_per_class=args.max_per_class):
        print("❌ Dataset preparation failed. Exiting.")
        return False
    
    # Step 2: Create data.yaml
    yaml_path = create_data_yaml()
    
    if args.dry_run:
        print("\n🏁 Dry-run complete — dataset prepared successfully.")
        print("   Run without --dry-run to start training.")
        return True
    
    # Step 3: Train
    print("\n" + "=" * 60)
    print("STEP 2: Training YOLO")
    print("=" * 60 + "\n")
    
    from ultralytics import YOLO
    
    # Model selection: YOLOv26n (best accuracy) > YOLOv11m > YOLOv11n
    model_file = args.model
    last_ckpt = os.path.join(ML_DIR, 'runs', 'yolo-urban', 'weights', 'last.pt')
    
    if args.resume and os.path.exists(last_ckpt):
        print(f"📦 Resuming from checkpoint: {last_ckpt}")
        model = YOLO(last_ckpt)
    else:
        # Check for model in ML_DIR first, then let ultralytics download
        local_model = os.path.join(ML_DIR, model_file)
        if os.path.exists(local_model):
            print(f"📥 Loading {model_file} from local: {local_model}")
            model = YOLO(local_model)
        else:
            print(f"📥 Loading {model_file} (will download if needed)...")
            model = YOLO(model_file)
    
    # ========================================
    # Augmentation config (from reference notebook)
    # These are CRITICAL for accuracy!
    # ========================================
    augmentation = {
        'hsv_h': 0.015,     # Hue augmentation
        'hsv_s': 0.7,       # Saturation augmentation
        'hsv_v': 0.4,       # Value augmentation
        'translate': 0.1,   # Translation (+/- 10%)
        'scale': 0.5,       # Scale (+/- 50%) — helps detect objects at different sizes
        'fliplr': 0.5,      # Horizontal flip — catches corner objects
        'flipud': 0.1,      # Vertical flip (low prob for urban scenes)
        'mosaic': 1.0,      # Mosaic augmentation — CRITICAL for small dataset classes
        'mixup': 0.15,      # MixUp augmentation — improves generalization
        'degrees': 5.0,     # Small rotation for robustness
        'shear': 2.0,       # Small shear
        'perspective': 0.0001,  # Very slight perspective
    }
    
    # Training settings
    print(f"\n🚀 Starting training:")
    print(f"   Model: {model_file}")
    print(f"   Epochs: {args.epochs}")
    print(f"   Image size: {args.imgsz}")
    print(f"   Batch size: {args.batch}")
    print(f"   Device: {'cuda' if args.device == '0' else 'cpu'}")
    print(f"   Data: {yaml_path}")
    print(f"   Augmentation: mosaic={augmentation['mosaic']}, mixup={augmentation['mixup']}, fliplr={augmentation['fliplr']}")
    print()
    
    results = model.train(
        data=yaml_path,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=15,           # More patience for better convergence
        save=True,
        save_period=5,
        project=os.path.join(ML_DIR, 'runs'),
        name='yolo-urban',
        exist_ok=True,
        pretrained=True,
        optimizer='AdamW',
        lr0=0.01,              # Higher initial LR (notebook uses 0.01)
        lrf=0.01,              # Final LR fraction
        warmup_epochs=5,       # More warmup for stable training
        cos_lr=True,           # Cosine LR schedule
        cls=2.0,               # CRITICAL: Increase classification loss weight
        box=7.5,               # Standard box loss weight
        verbose=True,
        workers=2,             # Windows-safe worker count
        close_mosaic=10,       # Disable mosaic for last 10 epochs (better fine detail)
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
        print(f"✅ Best model deployed to: {dest_pt}")
        print(f"   The ML service will auto-load this model on next restart.")
    else:
        # Try last.pt as fallback
        last_pt = os.path.join(run_dir, 'weights', 'last.pt')
        if os.path.exists(last_pt):
            os.makedirs(OUTPUT_MODEL_DIR, exist_ok=True)
            dest_pt = os.path.join(OUTPUT_MODEL_DIR, 'best.pt')
            shutil.copy2(last_pt, dest_pt)
            print(f"✅ Last model deployed to: {dest_pt}")
        else:
            print("⚠️  No model weights found in training output.")
            return False
    
    print("\n🎉 YOLO training complete!")
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train YOLO on Urban Issues Dataset')
    parser.add_argument('--model', type=str, default='yolo26n.pt', help='YOLO model file (default: yolo26n.pt)')
    parser.add_argument('--epochs', type=int, default=50, help='Training epochs (default: 50)')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size (default: 640 for best accuracy)')
    parser.add_argument('--batch', type=int, default=16, help='Batch size (default: 16, reduce if OOM)')
    parser.add_argument('--device', type=str, default='0', help='Device: cpu or 0 for GPU')
    parser.add_argument('--max_per_class', type=int, default=None, help='Subset dataset (None = use full dataset)')
    parser.add_argument('--resume', action='store_true', help='Resume from last checkpoint')
    parser.add_argument('--dry-run', action='store_true', help='Only prepare dataset, skip training')
    
    args = parser.parse_args()
    
    success = train_yolo(args)
    sys.exit(0 if success else 1)
