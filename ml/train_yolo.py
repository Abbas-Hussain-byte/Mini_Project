"""
CivicPulse — YOLOv8 Fine-Tuning on Kaggle Urban Issues Dataset
Handles the nested ClassName/ClassName/split/images structure,
remaps labels to a unified 10-class scheme, and trains YOLOv8n.

Usage:
    python train_yolo.py                        # Full training (30 epochs)
    python train_yolo.py --epochs 5 --dry-run   # Quick test
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
    """Fine-tune YOLOv8n on the prepared dataset."""
    
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
    print("STEP 2: Training YOLOv8")
    print("=" * 60 + "\n")
    
    from ultralytics import YOLO
    
    # Load existing checkpoint to preserve the 14-hour training!
    last_ckpt = os.path.join(ML_DIR, 'runs', 'yolo-urban', 'weights', 'last.pt')
    base_model = os.path.join(ML_DIR, 'yolov8n.pt')
    
    if os.path.exists(last_ckpt):
        print(f"📦 Resuming from your hard-earned checkpoint: {last_ckpt}")
        print("   -> (Preserving all knowledge from the 14-hour run!)")
        model = YOLO(last_ckpt)
    elif not os.path.exists(base_model):
        print("📥 Downloading YOLOv8n pretrained weights...")
        model = YOLO('yolov8n.pt')
    else:
        print(f"📦 Loading base model: {base_model}")
        model = YOLO(base_model)
    
    # Training with CPU-friendly settings
    print(f"\n🚀 Starting training:")
    print(f"   Epochs: {args.epochs}")
    print(f"   Image size: {args.imgsz}")
    print(f"   Batch size: {args.batch}")
    print(f"   Device: {'cuda' if args.device == '0' else 'cpu'}")
    print(f"   Data: {yaml_path}")
    print()
    
    results = model.train(
        data=yaml_path,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=10,           # Early stopping
        save=True,
        save_period=5,         # Save every 5 epochs
        project=os.path.join(ML_DIR, 'runs'),
        name='yolo-urban',
        exist_ok=True,
        pretrained=True,
        optimizer='AdamW',
        lr0=0.001,
        lrf=0.01,
        warmup_epochs=3,
        cos_lr=True,
        verbose=True,
        workers=2,  # Fix: Prevents Windows from crashing due to running out of RAM (Paging File Error)
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
    parser = argparse.ArgumentParser(description='Train YOLOv8 on Urban Issues Dataset')
    parser.add_argument('--epochs', type=int, default=30, help='Training epochs (default: 30)')
    parser.add_argument('--imgsz', type=int, default=416, help='Image size (default: 416, use 640 for better accuracy)')
    parser.add_argument('--batch', type=int, default=8, help='Batch size (default: 8, reduce if OOM)')
    parser.add_argument('--device', type=str, default='cpu', help='Device: cpu or 0 for GPU')
    parser.add_argument('--max_per_class', type=int, default=400, help='Subset dataset for faster CPU training (e.g., 400 imgs/class)')
    parser.add_argument('--dry-run', action='store_true', help='Only prepare dataset, skip training')
    
    args = parser.parse_args()
    
    success = train_yolo(args)
    sys.exit(0 if success else 1)
