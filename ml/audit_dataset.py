"""
Deep audit of Kaggle dataset: counts images, labels, class distributions,
and identifies label quality issues.
"""
import os, sys, glob, collections
sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE = os.path.join(PROJECT_ROOT, 'kaggle_archive')

DATASET_FOLDERS = [
    'Potholes and RoadCracks',
    'IllegalParking',
    'DamagedRoadSigns',
    'FallenTrees',
    'Garbage',
    'Graffitti',
    'DeadAnimalsPollution',
    'Damaged concrete structures',
    'DamagedElectricalPoles',
]

CLASSES = [
    'Damaged Road issues',            # 0
    'Pothole Issues',                 # 1
    'Illegal Parking Issues',         # 2
    'Broken Road Sign Issues',        # 3
    'Fallen trees',                   # 4
    'Littering/Garbage',              # 5
    'Vandalism Issues',               # 6
    'Dead Animal Pollution',          # 7
    'Damaged concrete structures',    # 8
    'Damaged Electric wires/poles',   # 9
]

print("=" * 80)
print("FULL KAGGLE DATASET AUDIT")
print("=" * 80)

grand_images = 0
grand_labels = 0
grand_annotations = 0
global_class_counts = collections.Counter()
global_images_without_labels = 0
global_empty_labels = 0
global_label_format_issues = []

for folder in DATASET_FOLDERS:
    folder_path = os.path.join(KAGGLE, folder)
    nested = os.path.join(folder_path, folder)
    data_path = nested if os.path.exists(nested) else folder_path
    
    folder_imgs = 0
    folder_lbls = 0
    folder_anns = 0
    folder_class_counts = collections.Counter()
    folder_no_label = 0
    folder_empty_label = 0
    
    for split in ['train', 'valid', 'test']:
        img_dir = os.path.join(data_path, split, 'images')
        lbl_dir = os.path.join(data_path, split, 'labels')
        
        if not os.path.exists(img_dir):
            continue
        
        images = [f for f in glob.glob(os.path.join(img_dir, '*'))
                  if f.lower().endswith(('.jpg','.jpeg','.png','.bmp','.webp'))]
        folder_imgs += len(images)
        
        for img_path in images:
            base = os.path.splitext(os.path.basename(img_path))[0]
            label_path = os.path.join(lbl_dir, base + '.txt')
            
            if not os.path.exists(label_path):
                folder_no_label += 1
                continue
            
            with open(label_path, 'r', encoding='utf-8-sig') as f:
                lines = f.readlines()
            
            valid_lines = 0
            for line in lines:
                line = line.strip().replace('\ufeff', '')
                if not line:
                    continue
                parts = line.split()
                if len(parts) < 5:
                    global_label_format_issues.append((folder, split, base, line))
                    continue
                try:
                    cls_id = int(parts[0])
                    folder_class_counts[cls_id] += 1
                    valid_lines += 1
                except ValueError:
                    global_label_format_issues.append((folder, split, base, line))
            
            if valid_lines > 0:
                folder_lbls += 1
                folder_anns += valid_lines
            else:
                folder_empty_label += 1
    
    print(f"\n{'─' * 60}")
    print(f"📁 {folder}")
    print(f"   Images: {folder_imgs} | Labels with annotations: {folder_lbls} | Annotations: {folder_anns}")
    print(f"   Images without label file: {folder_no_label} | Empty label files: {folder_empty_label}")
    print(f"   Class distribution:")
    for cls_id in sorted(folder_class_counts.keys()):
        name = CLASSES[cls_id] if cls_id < len(CLASSES) else f'UNKNOWN_{cls_id}'
        count = folder_class_counts[cls_id]
        bar = '█' * min(count // 50, 40)
        print(f"     [{cls_id}] {name:35} : {count:5d} {bar}")
    
    grand_images += folder_imgs
    grand_labels += folder_lbls
    grand_annotations += folder_anns
    global_class_counts.update(folder_class_counts)
    global_images_without_labels += folder_no_label
    global_empty_labels += folder_empty_label

print(f"\n{'=' * 80}")
print(f"GRAND TOTALS")
print(f"{'=' * 80}")
print(f"  Total images:             {grand_images}")
print(f"  Total labeled images:     {grand_labels}")
print(f"  Total annotations:        {grand_annotations}")
print(f"  Images without labels:    {global_images_without_labels}")
print(f"  Empty label files:        {global_empty_labels}")
print(f"  Format issues:            {len(global_label_format_issues)}")

print(f"\n  GLOBAL CLASS DISTRIBUTION:")
for cls_id in range(10):
    name = CLASSES[cls_id] if cls_id < len(CLASSES) else f'class_{cls_id}'
    count = global_class_counts.get(cls_id, 0)
    pct = (count / grand_annotations * 100) if grand_annotations > 0 else 0
    bar = '█' * min(count // 100, 40)
    status = '✅' if count > 100 else ('⚠️' if count > 0 else '❌')
    print(f"  [{cls_id}] {name:35} : {count:5d} ({pct:5.1f}%) {bar} {status}")

# Check for out-of-range class IDs
out_of_range = {k: v for k, v in global_class_counts.items() if k < 0 or k >= 10}
if out_of_range:
    print(f"\n  ⛔ OUT-OF-RANGE CLASS IDs FOUND: {out_of_range}")

if global_label_format_issues:
    print(f"\n  SAMPLE FORMAT ISSUES (first 10):")
    for folder, split, base, line in global_label_format_issues[:10]:
        print(f"    {folder}/{split}/{base}: '{line[:60]}'")

# Check for label/image ratio issues per split
print(f"\n  SPLIT BREAKDOWN:")
for folder in DATASET_FOLDERS:
    folder_path = os.path.join(KAGGLE, folder)
    nested = os.path.join(folder_path, folder)
    data_path = nested if os.path.exists(nested) else folder_path
    for split in ['train', 'valid', 'test']:
        img_dir = os.path.join(data_path, split, 'images')
        lbl_dir = os.path.join(data_path, split, 'labels')
        if os.path.exists(img_dir):
            n_img = len([f for f in os.listdir(img_dir) if f.lower().endswith(('.jpg','.jpeg','.png'))])
            n_lbl = len([f for f in os.listdir(lbl_dir) if f.endswith('.txt')]) if os.path.exists(lbl_dir) else 0
            mismatch = '⚠️ MISMATCH' if n_img != n_lbl else ''
            print(f"    {folder:35} {split:6} : {n_img:4d} imgs, {n_lbl:4d} lbls {mismatch}")
