"""
CivicPulse — Local YOLO Training (4GB VRAM Optimized)
======================================================
Uses the BALANCED dataset (data/prepared/) with optimized hyperparameters.

Model:  yolo11s (small, 9.4M params) — fits 4GB VRAM
Image:  640px (max for 4GB VRAM)
Batch:  4 (auto-reduces if OOM)
Epochs: 50 (patience=15 for early stop)

Expected: ~2-3 hours on GTX 1650/RTX 3050 class GPU
Expected mAP50: 55-65% (up from 43%)

Usage:
    python train_local_balanced.py                  # Full training
    python train_local_balanced.py --epochs 30      # Quick 30 epochs
    python train_local_balanced.py --model yolo11n   # Use nano (faster, less accurate)
    python train_local_balanced.py --resume          # Resume from last checkpoint
"""

import os
import sys
import argparse
import time

sys.stdout.reconfigure(encoding='utf-8')

ML_DIR = os.path.dirname(os.path.abspath(__file__))
PREPARED_DIR = os.path.join(ML_DIR, 'data', 'prepared')
DATA_YAML = os.path.join(PREPARED_DIR, 'data.yaml')
MODELS_DIR = os.path.join(ML_DIR, 'models', 'yolo-urban')


def check_prerequisites():
    """Verify balanced dataset exists."""
    if not os.path.exists(DATA_YAML):
        print("ERROR: Balanced dataset not found!")
        print(f"  Expected: {DATA_YAML}")
        print(f"  Run 'python balance_dataset.py' first.")
        return False

    # Count files
    for split in ['train', 'valid']:
        img_dir = os.path.join(PREPARED_DIR, 'images', split)
        lbl_dir = os.path.join(PREPARED_DIR, 'labels', split)
        if os.path.exists(img_dir):
            n_img = len(os.listdir(img_dir))
            n_lbl = len(os.listdir(lbl_dir)) if os.path.exists(lbl_dir) else 0
            print(f"  {split}: {n_img} images, {n_lbl} labels")

    return True


def train(args):
    """Run training with 4GB VRAM optimized settings."""

    print("\n" + "=" * 60)
    print("  CIVICPULSE LOCAL TRAINING (4GB VRAM)")
    print("=" * 60)

    if not check_prerequisites():
        return False

    # Import YOLO
    try:
        from ultralytics import YOLO
        import torch
    except ImportError:
        print("ERROR: ultralytics not installed. Run: pip install ultralytics")
        return False

    # GPU check
    if torch.cuda.is_available():
        gpu = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"\n  GPU: {gpu} ({vram:.1f} GB VRAM)")
    else:
        print("\n  WARNING: No GPU detected. Training on CPU (VERY slow).")

    # Model selection
    model_name = args.model + '.pt'
    if args.resume:
        last_pt = os.path.join(ML_DIR, 'runs', 'yolo-urban-balanced', 'weights', 'last.pt')
        if os.path.exists(last_pt):
            model = YOLO(last_pt)
            print(f"  Resuming from: {last_pt}")
        else:
            print(f"  No checkpoint found at {last_pt}, starting fresh")
            model = YOLO(model_name)
    else:
        model = YOLO(model_name)
        print(f"  Model: {model_name}")

    # Training config
    print(f"\n  Configuration:")
    print(f"    Image size:    640px")
    print(f"    Batch size:    {args.batch}")
    print(f"    Epochs:        {args.epochs}")
    print(f"    Optimizer:     AdamW")
    print(f"    cls weight:    3.0")
    print(f"    close_mosaic:  5")
    print(f"    AMP:           True (FP16)")
    print(f"    Cache:         disk")
    print()

    start_time = time.time()

    results = model.train(
        data=DATA_YAML,
        epochs=args.epochs,
        imgsz=640,                 # 640px — fits 4GB VRAM
        batch=args.batch,          # 4 for 4GB VRAM (auto-reduces if OOM)
        device=0 if torch.cuda.is_available() else 'cpu',
        patience=15,               # Early stop if no improvement for 15 epochs
        save=True,
        save_period=5,             # Checkpoint every 5 epochs
        project=os.path.join(ML_DIR, 'runs'),
        name='yolo-urban-balanced',
        exist_ok=True,
        pretrained=True,
        optimizer='AdamW',
        lr0=0.01,
        lrf=0.01,
        warmup_epochs=3,           # Shorter warmup for fewer epochs
        cos_lr=True,
        cls=3.0,                   # BOOSTED classification loss
        box=7.5,
        verbose=True,
        workers=2,                 # Safe for Windows
        close_mosaic=5,            # Prevents training collapse
        amp=True,                  # FP16 mixed precision
        cache='disk',              # Disk cache — saves RAM
        resume=args.resume,
        # Augmentation — tuned for urban scenes
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        flipud=0.0,               # NO vertical flip for urban scenes
        mosaic=1.0,
        mixup=0.15,
        degrees=3.0,
        shear=2.0,
        perspective=0.0001,
    )

    elapsed = time.time() - start_time
    hours = elapsed / 3600
    print(f"\n  Training completed in {hours:.1f} hours")

    # Copy best.pt to models directory
    best_src = os.path.join(ML_DIR, 'runs', 'yolo-urban-balanced', 'weights', 'best.pt')
    if os.path.exists(best_src):
        os.makedirs(MODELS_DIR, exist_ok=True)
        import shutil
        dest = os.path.join(MODELS_DIR, 'best.pt')
        shutil.copy2(best_src, dest)
        print(f"\n  ✅ best.pt copied to: {dest}")
        print(f"     Restart 'python app.py' to use the new model!")

        # Quick validation
        print(f"\n  Running validation...")
        model_val = YOLO(best_src)
        metrics = model_val.val(
            data=DATA_YAML,
            imgsz=640,
            batch=args.batch,
            device=0 if torch.cuda.is_available() else 'cpu',
            verbose=True
        )

        print(f"\n  {'=' * 50}")
        print(f"  FINAL RESULTS:")
        print(f"  {'=' * 50}")
        print(f"    mAP50:     {metrics.box.map50:.4f}  ({metrics.box.map50*100:.1f}%)")
        print(f"    mAP50-95:  {metrics.box.map:.4f}  ({metrics.box.map*100:.1f}%)")
        print(f"    Precision: {metrics.box.mp:.4f}")
        print(f"    Recall:    {metrics.box.mr:.4f}")

        class_names = [
            'Damaged Road', 'Pothole', 'Illegal Parking', 'Broken Road Sign',
            'Fallen Trees', 'Littering', 'Vandalism', 'Dead Animal',
            'Damaged Concrete', 'Electric Wires'
        ]
        print(f"\n  PER-CLASS mAP50:")
        for i, (name, ap) in enumerate(zip(class_names, metrics.box.ap50)):
            bar = '#' * int(ap * 30)
            status = '✅' if ap > 0.3 else '⚠️' if ap > 0.1 else '❌'
            print(f"    [{i}] {name:20} : {ap*100:5.1f}% {bar} {status}")

    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='CivicPulse Local YOLO Training')
    parser.add_argument('--epochs', type=int, default=50, help='Training epochs (default: 50)')
    parser.add_argument('--batch', type=int, default=8, help='Batch size (default: 8 for RTX 3050 4GB, auto-reduces if OOM)')
    parser.add_argument('--model', type=str, default='yolo11s', help='Model: yolo11n, yolo11s, yolo11m (default: yolo11s)')
    parser.add_argument('--resume', action='store_true', help='Resume from last checkpoint')
    args = parser.parse_args()

    success = train(args)
    sys.exit(0 if success else 1)
