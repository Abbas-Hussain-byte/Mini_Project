import os
import glob
import random
from collections import Counter

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE_DATA_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

DATASET_FOLDERS = [
    ('Potholes and RoadCracks', [0, 1]),
    ('IllegalParking', [2]),
    ('DamagedRoadSigns', [3]),
    ('FallenTrees', [4]),
    ('Garbage', [5]),
    ('Graffitti', [6]),
    ('DeadAnimalsPollution', [7]),
    ('Damaged concrete structures', [8]),
    ('DamagedElectricalPoles', [9]),
]

def diagnose_labels(sample_size=500):
    print(f"\nStarting Dataset Diagnostic (Audit Size: {sample_size} samples)...")
    
    results = {
        'total_files': 0,
        'valid_yolo_format': 0,
        'suspected_corner_format': 0, # xyxy
        'out_of_bounds': 0,
        'inverted_boxes': 0, # xmin > xmax etc
        'class_mismatches': 0,
        'empty_files': 0,
        'class_distribution': Counter()
    }
    
    all_label_files = []
    folder_map = {} # label_path -> expected_classes
    
    for folder_name, expected_ids in DATASET_FOLDERS:
        folder_path = os.path.join(KAGGLE_DATA_DIR, folder_name)
        if not os.path.exists(folder_path): continue
        
        # Handle nesting
        nested = os.path.join(folder_path, folder_name)
        data_path = nested if os.path.exists(nested) else folder_path
        
        for split in ['train', 'valid', 'test']:
            lp = os.path.join(data_path, split, 'labels', '*.txt')
            files = glob.glob(lp)
            all_label_files.extend(files)
            for f in files:
                folder_map[f] = expected_ids

    if not all_label_files:
        print("❌ No label files found!")
        return

    sample = random.sample(all_label_files, min(sample_size, len(all_label_files)))
    results['total_files'] = len(sample)

    for label_path in sample:
        expected_ids = folder_map[label_path]
        
        if os.path.getsize(label_path) == 0:
            results['empty_files'] += 1
            continue
            
        with open(label_path, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
            
        for line in lines:
            parts = line.strip().split()
            if len(parts) < 5: continue
            
            try:
                cls_id = int(parts[0])
                coords = [float(x) for x in parts[1:5]] # cx, cy, w, h OR x1, y1, x2, y2
                
                results['class_distribution'][cls_id] += 1
                
                # 1. Class ID Mismatch Check
                if cls_id not in expected_ids:
                    results['class_mismatches'] += 1
                    # print(f"  [!] Class Mismatch: {os.path.basename(label_path)} has class {cls_id}, expected {expected_ids}")

                # 2. Coordinate Check
                if any(x < 0 or x > 1 for x in coords):
                    results['out_of_bounds'] += 1
                
                v1, v2, v3, v4 = coords
                
                # 3. Format Detection (Inverted)
                # In YOLO (cx, cy, w, h), w and h are usually smaller than cx, cy in many cases,
                # but NOT ALWAYS. 
                # HOWEVER, in XYXY format, v3 MUST be > v1 and v4 MUST be > v2.
                # If v3 < v1 or v4 < v2, it CANNOT be XYXY format.
                if v3 < v1 or v4 < v2:
                    results['valid_yolo_format'] += 1
                else:
                    # If it COULD be both, it's ambiguous, but if it looks like CORNER...
                    # If v1, v2 are very small and v3, v4 are large, it's likely XYXY.
                    if v1 < 0.2 and v2 < 0.2 and v3 > 0.8 and v4 > 0.8:
                         # This would be a massive box in YOLO (center at origin), 
                         # but a full-image box in XYXY.
                         results['suspected_corner_format'] += 1
                    else:
                        results['valid_yolo_format'] += 1

            except ValueError:
                continue

    # Summary Report
    print("-" * 60)
    print(f"DIAGNOSTIC SUMMARY ({len(sample)} files audited)")
    print("-" * 60)
    print(f"Valid YOLO (cxcywh) Style: {results['valid_yolo_format']}")
    print(f"Suspected Corner (xyxy) Style: {results['suspected_corner_format']}")
    print(f"Class Mismatches: {results['class_mismatches']}")
    print(f"Empty/Corrupt Files: {results['empty_files']}")
    print(f"Out of Bounds ( > 1.0): {results['out_of_bounds']}")
    
    print("\nClass ID Distribution in Sample:")
    for cid, count in sorted(results['class_distribution'].items()):
         print(f"   Class {cid}: {count} annotations")

    print("-" * 60)
    if results['class_mismatches'] > (len(sample) * 0.1):
        print("🚩 MAJOR FINDING: High rate of class mismatches detected! Folders are mixed.")
    if results['suspected_corner_format'] > 0:
        print(f"🚩 MAJOR FINDING: {results['suspected_corner_format']} files suspected to be in WRONG format (Corner vs Center).")
    
    print("\nNext Step: Run fix_labels.py to normalize formats if needed.")

if __name__ == "__main__":
    diagnose_labels(1000)
