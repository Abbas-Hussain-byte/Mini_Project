import os
import glob
from collections import Counter

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE_DATA_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

# Mapping of folder names to the SINGLE expected class ID
# Folders that can have multiple classes (like Potholes) will be handled specially
FOLDER_TO_ID = {
    'IllegalParking': 2,
    'DamagedRoadSigns': 3,
    'FallenTrees': 4,
    'Garbage': 5,
    'Graffitti': 6,
    'DeadAnimalsPollution': 7,
    'Damaged concrete structures': 8,
    'DamagedElectricalPoles': 9,
}

# Mapping for the special folder that contains two classes
MULTICLASS_FOLDERS = {
    'Potholes and RoadCracks': [0, 1] # 0 = damaged road, 1 = pothole
}

def purify_dataset():
    print(f"\n--- Global Dataset Purification Started ---")
    print(f"Path: {KAGGLE_DATA_DIR}\n")
    
    stats = {
        'total_processed': 0,
        'fixed_mismatch': 0,
        'deleted_empty': 0,
        'skipped_invalid': 0,
        'distribution': Counter()
    }

    # 1. Process standard folders (1:1 mapping)
    for folder_name, target_id in FOLDER_TO_ID.items():
        folder_path = os.path.join(KAGGLE_DATA_DIR, folder_name)
        if not os.path.exists(folder_path): continue
        
        # Handle nesting
        nested = os.path.join(folder_path, folder_name)
        data_path = nested if os.path.exists(nested) else folder_path
        
        print(f"Purifying {folder_name} (Forcing ID {target_id})...")
        
        for split in ['train', 'valid', 'test']:
            lp = os.path.join(data_path, split, 'labels', '*.txt')
            files = glob.glob(lp)
            
            for label_path in files:
                stats['total_processed'] += 1
                
                if os.path.getsize(label_path) == 0:
                    os.remove(label_path)
                    stats['deleted_empty'] += 1
                    continue
                
                with open(label_path, 'r', encoding='utf-8-sig') as f:
                    lines = f.readlines()
                
                new_lines = []
                mismatch_found = False
                
                for line in lines:
                    parts = line.strip().split()
                    if not parts: continue
                    
                    try:
                        current_id = int(parts[0])
                        if current_id != target_id:
                            mismatch_found = True
                            parts[0] = str(target_id)
                        
                        new_lines.append(" ".join(parts) + "\n")
                        stats['distribution'][target_id] += 1
                    except ValueError:
                        continue
                
                if mismatch_found:
                    with open(label_path, 'w') as f:
                        f.writelines(new_lines)
                    stats['fixed_mismatch'] += 1

    # 2. Process multiclass folders (Just check for valid range)
    for folder_name, valid_ids in MULTICLASS_FOLDERS.items():
        folder_path = os.path.join(KAGGLE_DATA_DIR, folder_name)
        if not os.path.exists(folder_path): continue
        
        nested = os.path.join(folder_path, folder_name)
        data_path = nested if os.path.exists(nested) else folder_path
        
        print(f"Checking {folder_name} (Valid IDs: {valid_ids})...")
        
        for split in ['train', 'valid', 'test']:
            lp = os.path.join(data_path, split, 'labels', '*.txt')
            files = glob.glob(lp)
            
            for label_path in files:
                stats['total_processed'] += 1
                with open(label_path, 'r', encoding='utf-8-sig') as f:
                    lines = f.readlines()
                
                for line in lines:
                    parts = line.strip().split()
                    if not parts: continue
                    try:
                        stats['distribution'][int(parts[0])] += 1
                    except ValueError: pass

    # Report
    print("\n" + "="*60)
    print("PURIFICATION COMPLETE")
    print("="*60)
    print(f"Total labels processed: {stats['total_processed']}")
    print(f"Mismatched IDs fixed:  {stats['fixed_mismatch']}")
    print(f"Deleted empty files:  {stats['deleted_empty']}")
    
    print("\nNew Distribution (Full Dataset):")
    for i in range(10):
        print(f"   Class {i}: {stats['distribution'].get(i, 0):6d} annotations")
    print("="*60)

if __name__ == "__main__":
    purify_dataset()
