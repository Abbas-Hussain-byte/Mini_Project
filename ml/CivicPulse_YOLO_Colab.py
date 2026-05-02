"""
==============================================================================
CivicPulse YOLO Fine-Tuning — Google Colab Notebook
==============================================================================

HOW TO USE THIS ON GOOGLE COLAB:
================================
1. Open Google Colab: https://colab.research.google.com
2. Go to File -> Upload Notebook -> Upload this .py file
   OR create a new notebook and paste each section into separate cells
3. Change Runtime: Runtime -> Change runtime type -> GPU (T4)
4. Run each cell in order

The cells are separated by: # %% [markdown] and # %%

WHAT THIS DOES:
===============
- Trains YOLOv11m (medium) at 1024px resolution on balanced urban issues data
- Uses checkpoint-resume for Colab free tier (4hr session limit)
- Saves everything to Google Drive so you don't lose progress
- Downloads the best.pt model at the end

PREREQUISITES:
==============
Before running this, you need to:
1. Run `python balance_dataset.py` locally on your machine
2. Zip the prepared dataset: the ml/data/prepared/ folder
3. Upload that zip to your Google Drive root folder as 'civicpulse_dataset.zip'

To create the zip locally, run this in PowerShell:
  cd C:\\Users\\Awes\\Desktop\\ABBAS_DOCS\\Mini_Project\\ml\\data
  Compress-Archive -Path prepared -DestinationPath civicpulse_dataset.zip

Then upload civicpulse_dataset.zip to your Google Drive root.
==============================================================================
"""

# %% [markdown]
# # CivicPulse YOLO Fine-Tuning on Google Colab
# **Goal**: Improve mAP50 from 43% to 65%+ using balanced dataset + larger model + higher resolution
#
# **Key upgrades over local training:**
# - `yolo11m` (20M params) instead of `yolo11n` (2.6M params)
# - `1024px` image size instead of `640px`
# - `batch=16` for stable gradients (instead of batch=4)
# - Balanced dataset (15x imbalance instead of 253x)
# - Proper `close_mosaic=5` to prevent training collapse

# %% — Cell 1: Setup and Install
# ===============================
print("=" * 60)
print("  CELL 1: Installing Dependencies")
print("=" * 60)

import subprocess
import sys

# Install ultralytics (includes YOLOv11 support)
subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q',
                       'ultralytics>=8.3.0', 'pyyaml'])

print("\n[OK] Ultralytics installed")

# Check GPU
import torch
if torch.cuda.is_available():
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_mem / 1024**3
    print(f"[OK] GPU: {gpu_name} ({gpu_mem:.1f} GB VRAM)")
else:
    print("[WARNING] No GPU detected! Training will be VERY slow.")
    print("  Go to: Runtime -> Change runtime type -> GPU (T4)")

# %% — Cell 2: Mount Google Drive & Extract Dataset
# ===================================================
print("\n" + "=" * 60)
print("  CELL 2: Mounting Google Drive & Preparing Dataset")
print("=" * 60)

from google.colab import drive
import os, shutil, zipfile, yaml

# Mount Drive
drive.mount('/content/drive')

# Paths
DRIVE_ROOT = '/content/drive/MyDrive'
WORK_DIR = '/content/civicpulse'
DATASET_DIR = os.path.join(WORK_DIR, 'prepared')
DRIVE_CHECKPOINT_DIR = os.path.join(DRIVE_ROOT, 'civicpulse_training')
DRIVE_ZIP = os.path.join(DRIVE_ROOT, 'civicpulse_dataset.zip')

# Create working directory
os.makedirs(WORK_DIR, exist_ok=True)
os.makedirs(DRIVE_CHECKPOINT_DIR, exist_ok=True)

# Extract dataset
if not os.path.exists(DATASET_DIR) or not os.path.exists(os.path.join(DATASET_DIR, 'data.yaml')):
    if os.path.exists(DRIVE_ZIP):
        print(f"  Extracting dataset from: {DRIVE_ZIP}")
        with zipfile.ZipFile(DRIVE_ZIP, 'r') as z:
            z.extractall(WORK_DIR)
        
        # FIX: Check if files were extracted with backslashes (common Windows zip issue on Linux)
        # This converts "prepared\data.yaml" -> "prepared/data.yaml"
        print("  Checking for Windows path issues...")
        for f in os.listdir(WORK_DIR):
            if '\\' in f:
                old_path = os.path.join(WORK_DIR, f)
                new_name = f.replace('\\', '/')
                new_path = os.path.join(WORK_DIR, new_name)
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                shutil.move(old_path, new_path)
        
        print(f"  [OK] Extraction and path cleaning complete.")
    else:
        print(f"  [ERROR] Dataset zip not found at: {DRIVE_ZIP}")
        print(f"  Please upload 'civicpulse_dataset.zip' to your Google Drive root!")
        raise FileNotFoundError(f"Upload civicpulse_dataset.zip to Google Drive root first!")
else:
    print(f"  [OK] Dataset already exists and is valid at: {DATASET_DIR}")

# Detect the correct DATASET_DIR (it might be WORK_DIR or WORK_DIR/prepared)
if os.path.exists(os.path.join(WORK_DIR, 'prepared', 'data.yaml')):
    DATASET_DIR = os.path.join(WORK_DIR, 'prepared')
elif os.path.exists(os.path.join(WORK_DIR, 'data.yaml')):
    DATASET_DIR = WORK_DIR
else:
    # Deep search for data.yaml
    found = False
    for root, dirs, files in os.walk(WORK_DIR):
        if 'data.yaml' in files:
            DATASET_DIR = root
            found = True
            break
    if not found:
        raise FileNotFoundError(f"Could not find data.yaml anywhere in {WORK_DIR} after extraction!")

print(f"  [INFO] Using DATASET_DIR: {DATASET_DIR}")

# Fix paths in data.yaml to point to Colab directory
yaml_path = os.path.join(DATASET_DIR, 'data.yaml')
with open(yaml_path, 'r') as f:
    data_config = yaml.safe_load(f)

# Ensure 'path' in yaml points to where images/labels actually are
data_config['path'] = DATASET_DIR
with open(yaml_path, 'w') as f:
    yaml.dump(data_config, f, default_flow_style=False, sort_keys=False)

print(f"\n  Dataset config updated:")
print(f"    Path: {data_config['path']}")
print(f"    Classes: {data_config['nc']}")
print(f"    Names: {data_config['names']}")

# Count files to verify
for split in ['train', 'valid', 'test']:
    img_dir = os.path.join(DATASET_DIR, 'images', split)
    n_img = len(os.listdir(img_dir)) if os.path.exists(img_dir) else 0
    print(f"    {split}: {n_img} images found")

# %% — Cell 3: Train YOLO (with checkpoint resume)
# ==================================================
print("\n" + "=" * 60)
print("  CELL 3: Training YOLOv11m")
print("=" * 60)

from ultralytics import YOLO
import shutil

# ========================================
# Checkpoint resume logic for free tier
# ========================================
TRAIN_DIR = os.path.join(WORK_DIR, 'runs', 'yolo-urban')
DRIVE_BEST = os.path.join(DRIVE_CHECKPOINT_DIR, 'best.pt')
DRIVE_LAST = os.path.join(DRIVE_CHECKPOINT_DIR, 'last.pt')

# Fallback: If user has the weights nested in the runs/ folder in Drive
nested_last = os.path.join(DRIVE_CHECKPOINT_DIR, 'runs', 'yolo-urban', 'weights', 'last.pt')
if not os.path.exists(DRIVE_LAST) and os.path.exists(nested_last):
    DRIVE_LAST = nested_last
    print(f"  [INFO] Found checkpoint in nested folder: {nested_last}")

# Check if we have a checkpoint from a previous session
resume_from = None
if os.path.exists(DRIVE_LAST):
    print(f"  [RESUME] Found checkpoint from previous session!")
    print(f"    Copying last.pt from Drive to local...")
    os.makedirs(os.path.join(TRAIN_DIR, 'weights'), exist_ok=True)
    try:
        shutil.copy2(DRIVE_LAST, os.path.join(TRAIN_DIR, 'weights', 'last.pt'))
    except shutil.SameFileError:
        pass  # User used a symlink, so they are the same physical file
    resume_from = os.path.join(TRAIN_DIR, 'weights', 'last.pt')
    print(f"    [OK] Will resume training from checkpoint")
else:
    print(f"  [NEW] Starting fresh training with yolo11m.pt")

# ========================================
# Model selection
# ========================================
if resume_from:
    model = YOLO(resume_from)
    print(f"  Model: Resuming from checkpoint")
else:
    model = YOLO('yolo11m.pt')  # Medium model — 20M params, fits T4 16GB
    print(f"  Model: yolo11m.pt (medium, 20M parameters)")

# ========================================
# Training hyperparameters — OPTIMIZED
# ========================================
print(f"\n  Training configuration:")
print(f"    Image size: 1024px")
print(f"    Batch size: 4")
print(f"    Epochs: 100")
print(f"    Optimizer: AdamW")
print(f"    close_mosaic: 5 (prevents training collapse)")
print(f"    cls weight: 3.0 (boosts classification accuracy)")
print(f"    AMP: True (FP16 for speed)")
print(f"    Cache: ram (Colab has plenty)")
print()

# ========================================
# Auto-Backup Callback for Free Tier
# ========================================
def backup_checkpoint(trainer):
    """Automatically copy checkpoint to Drive at the end of each epoch."""
    import shutil, os
    last_pt = os.path.join(trainer.save_dir, 'weights', 'last.pt')
    if os.path.exists(last_pt):
        os.makedirs(DRIVE_CHECKPOINT_DIR, exist_ok=True)
        try:
            shutil.copy2(last_pt, DRIVE_LAST)
        except shutil.SameFileError:
            pass  # User used a symlink, files are identical

model.add_callback("on_fit_epoch_end", backup_checkpoint)

results = model.train(
    data=yaml_path,
    epochs=100,
    imgsz=1024,              # HIGH RESOLUTION — critical for small objects
    batch=4,                 # Reduced from 16 — T4 needs lower batch for 1024px
    device=0,
    patience=30,             # Don't stop too early
    save=True,
    save_period=5,           # Save checkpoint every 5 epochs (for free tier resume)
    project=os.path.join(WORK_DIR, 'runs'),
    name='yolo-urban',
    exist_ok=True,
    pretrained=True,
    optimizer='AdamW',
    lr0=0.01,                # Standard LR for fresh training
    lrf=0.01,                # Final LR = 1% of initial
    warmup_epochs=5,         # Proper warmup
    cos_lr=True,             # Cosine LR schedule
    cls=3.0,                 # BOOSTED classification loss (was 2.0)
    box=7.5,                 # Standard box loss
    verbose=True,
    workers=4,               # Colab can handle more workers
    close_mosaic=5,          # REDUCED from 15 — prevents training collapse
    amp=True,                # FP16 mixed precision
    cache='ram',             # Colab has 12GB+ RAM — use it for speed
    resume=bool(resume_from),
    # Augmentation — tuned for urban scenes
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    translate=0.1,
    scale=0.5,
    fliplr=0.5,
    flipud=0.0,              # NO vertical flip for urban scenes (unnatural)
    mosaic=1.0,
    mixup=0.15,
    degrees=3.0,             # Slight rotation
    shear=2.0,
    perspective=0.0001,
)

print("\n[OK] Training complete!")

# %% — Cell 4: Save Results to Google Drive
# ==========================================
print("\n" + "=" * 60)
print("  CELL 4: Saving Results to Google Drive")
print("=" * 60)

import shutil

TRAIN_DIR = os.path.join(WORK_DIR, 'runs', 'yolo-urban')

# Save best.pt to Drive
best_local = os.path.join(TRAIN_DIR, 'weights', 'best.pt')
last_local = os.path.join(TRAIN_DIR, 'weights', 'last.pt')

if os.path.exists(best_local):
    shutil.copy2(best_local, DRIVE_BEST)
    print(f"  [OK] best.pt saved to: {DRIVE_BEST}")
    print(f"       Size: {os.path.getsize(best_local) / 1024 / 1024:.1f} MB")
else:
    print(f"  [WARNING] best.pt not found at: {best_local}")

if os.path.exists(last_local):
    shutil.copy2(last_local, DRIVE_LAST)
    print(f"  [OK] last.pt saved to: {DRIVE_LAST}")
else:
    print(f"  [WARNING] last.pt not found")

# Save results files
for fname in ['results.csv', 'results.png', 'confusion_matrix.png',
              'confusion_matrix_normalized.png', 'args.yaml', 'labels.jpg']:
    src = os.path.join(TRAIN_DIR, fname)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(DRIVE_CHECKPOINT_DIR, fname))
        print(f"  [OK] {fname} saved to Drive")

print(f"\n  All results saved to: {DRIVE_CHECKPOINT_DIR}")
print(f"\n  NEXT STEPS:")
print(f"  1. Download 'best.pt' from Google Drive folder: civicpulse_training/")
print(f"  2. Copy it to your local machine at:")
print(f"     C:\\Users\\Awes\\Desktop\\ABBAS_DOCS\\Mini_Project\\ml\\models\\yolo-urban\\best.pt")
print(f"  3. Restart your ML service: python app.py")

# %% — Cell 5: Quick Validation (Optional)
# =========================================
print("\n" + "=" * 60)
print("  CELL 5: Validation Results")
print("=" * 60)

from ultralytics import YOLO

# Load the best model
best_path = os.path.join(DRIVE_CHECKPOINT_DIR, 'best.pt')
if os.path.exists(best_path):
    model = YOLO(best_path)
    metrics = model.val(data=yaml_path, imgsz=1024, batch=16, device=0, verbose=True)

    print(f"\n  FINAL METRICS:")
    print(f"    mAP50:    {metrics.box.map50:.4f}  ({metrics.box.map50*100:.1f}%)")
    print(f"    mAP50-95: {metrics.box.map:.4f}  ({metrics.box.map*100:.1f}%)")
    print(f"    Precision: {metrics.box.mp:.4f}")
    print(f"    Recall:    {metrics.box.mr:.4f}")

    print(f"\n  PER-CLASS mAP50:")
    class_names = [
        'Damaged Road', 'Pothole', 'Illegal Parking', 'Broken Road Sign',
        'Fallen Trees', 'Littering', 'Vandalism', 'Dead Animal',
        'Damaged Concrete', 'Electric Wires'
    ]
    for i, (name, ap) in enumerate(zip(class_names, metrics.box.ap50)):
        bar = '#' * int(ap * 40)
        print(f"    [{i}] {name:20} : {ap*100:5.1f}% {bar}")
else:
    print("  [SKIP] No best.pt found — train the model first (Cell 3)")

# %% [markdown]
# ## Checkpoint Resume Instructions
#
# If your Colab session disconnects (free tier 4hr limit):
#
# 1. **Don't panic** — checkpoints are saved to Google Drive every 5 epochs
# 2. Open a new Colab session
# 3. Run Cells 1-3 again — Cell 3 will automatically detect `last.pt` on Drive and resume
# 4. Training continues from where it left off
#
# ## After Training
#
# 1. Go to Google Drive → `civicpulse_training/` folder
# 2. Download `best.pt`
# 3. Copy to: `Mini_Project/ml/models/yolo-urban/best.pt`
# 4. Restart ML service: `python app.py`
