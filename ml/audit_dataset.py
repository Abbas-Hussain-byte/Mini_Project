"""Full audit of kaggle_archive: duplicates, label quality, class IDs."""
import os, hashlib, glob

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'kaggle_archive')

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()

def audit_category(name):
    base = os.path.join(ROOT, name, name, 'train')
    img_dir = os.path.join(base, 'images')
    lbl_dir = os.path.join(base, 'labels')
    
    print(f"\n{'='*60}")
    print(f"  AUDIT: {name}")
    print(f"{'='*60}")
    
    # All images and labels
    all_imgs = sorted(glob.glob(os.path.join(img_dir, '*')))
    all_lbls = sorted(glob.glob(os.path.join(lbl_dir, '*')))
    custom_imgs = [f for f in all_imgs if os.path.basename(f).startswith('custom_real_')]
    custom_lbls = [f for f in all_lbls if os.path.basename(f).startswith('custom_real_')]
    istock_imgs = [f for f in all_imgs if os.path.basename(f).startswith('istock')]
    istock_lbls = [f for f in all_lbls if os.path.basename(f).startswith('istock')]
    orig_imgs = [f for f in all_imgs if not os.path.basename(f).startswith('custom_real_') and not os.path.basename(f).startswith('istock')]
    orig_lbls = [f for f in all_lbls if not os.path.basename(f).startswith('custom_real_') and not os.path.basename(f).startswith('istock')]
    
    print(f"\n  Total images: {len(all_imgs)}  |  Total labels: {len(all_lbls)}")
    print(f"  Original (Kaggle/Roboflow): {len(orig_imgs)} imgs, {len(orig_lbls)} lbls")
    print(f"  Custom real (downloaded):    {len(custom_imgs)} imgs, {len(custom_lbls)} lbls")
    print(f"  iStock (downloaded):         {len(istock_imgs)} imgs, {len(istock_lbls)} lbls")
    
    # --- Check for DUPLICATE custom images by MD5 hash ---
    print(f"\n  --- Duplicate Check (MD5 hash) ---")
    hashes = {}
    dupes = []
    for img in custom_imgs:
        h = md5(img)
        if h in hashes:
            dupes.append((os.path.basename(hashes[h]), os.path.basename(img), h))
        else:
            hashes[h] = img
    
    if dupes:
        print(f"  ⚠️  FOUND {len(dupes)} DUPLICATE PAIRS:")
        for f1, f2, h in dupes:
            print(f"     {f1}  ==  {f2}")
    else:
        print(f"  ✅ No exact duplicate custom images found")
    
    # --- Check label CLASS IDs ---
    print(f"\n  --- Label Class ID Analysis ---")
    
    # Original labels
    orig_class_ids = {}
    for lbl in orig_lbls[:50]:  # sample 50
        try:
            with open(lbl) as f:
                for line in f:
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        cid = parts[0]
                        orig_class_ids[cid] = orig_class_ids.get(cid, 0) + 1
        except: pass
    print(f"  Original labels use class IDs: {dict(orig_class_ids)}")
    
    # Custom labels
    custom_class_ids = {}
    fallback_count = 0
    proper_count = 0
    generic_80_count = 0
    for lbl in custom_lbls:
        try:
            with open(lbl) as f:
                content = f.read().strip()
                for line in content.split('\n'):
                    parts = line.strip().split()
                    if len(parts) >= 5:
                        cid = parts[0]
                        custom_class_ids[cid] = custom_class_ids.get(cid, 0) + 1
                        coords = [float(x) for x in parts[1:5]]
                        if coords == [0.5, 0.5, 0.9, 0.9]:
                            fallback_count += 1
                        elif coords == [0.5, 0.5, 0.8, 0.8]:
                            generic_80_count += 1
                        elif coords == [0.5, 0.5, 1.0, 1.0]:
                            fallback_count += 1
                        else:
                            proper_count += 1
        except: pass
    print(f"  Custom labels use class IDs: {dict(custom_class_ids)}")
    print(f"  Custom labels with PROPER bounding boxes: {proper_count}")
    print(f"  Custom labels with FALLBACK (0.5 0.5 0.9 0.9 or 1.0 1.0): {fallback_count}")
    print(f"  Custom labels with generic 80% box (0.5 0.5 0.8 0.8): {generic_80_count}")
    
    # istock labels
    if istock_lbls:
        istock_class_ids = {}
        istock_fallback = 0
        for lbl in istock_lbls:
            try:
                with open(lbl) as f:
                    content = f.read().strip()
                    for line in content.split('\n'):
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            cid = parts[0]
                            istock_class_ids[cid] = istock_class_ids.get(cid, 0) + 1
                            coords = [float(x) for x in parts[1:5]]
                            if coords in [[0.5, 0.5, 0.9, 0.9], [0.5, 0.5, 1.0, 1.0], [0.5, 0.5, 0.8, 0.8]]:
                                istock_fallback += 1
            except: pass
        print(f"  iStock labels use class IDs: {dict(istock_class_ids)}")
        print(f"  iStock labels with FALLBACK boxes: {istock_fallback}/{len(istock_lbls)}")
    
    # --- CLASS ID MISMATCH WARNING ---
    expected_id = {'DeadAnimalsPollution': '7', 'DamagedElectricalPoles': '9'}.get(name)
    if expected_id:
        custom_ids_used = set(custom_class_ids.keys())
        orig_ids_used = set(orig_class_ids.keys())
        if custom_ids_used and expected_id not in custom_ids_used:
            print(f"\n  ⚠️  CLASS ID MISMATCH!")
            print(f"     Original labels use class {expected_id} (correct)")
            print(f"     Custom labels use class {list(custom_ids_used)} (WRONG!)")
            print(f"     train_yolo.py remaps ALL labels → class {expected_id}, so this is OK during training")
            print(f"     BUT auto_label_images.py writes class 0, not {expected_id}")
    
    # --- Check images without matching labels ---
    print(f"\n  --- Orphan Check ---")
    img_basenames = {os.path.splitext(os.path.basename(f))[0] for f in all_imgs}
    lbl_basenames = {os.path.splitext(os.path.basename(f))[0] for f in all_lbls}
    imgs_without_labels = img_basenames - lbl_basenames
    labels_without_imgs = lbl_basenames - img_basenames
    print(f"  Images without labels: {len(imgs_without_labels)}")
    print(f"  Labels without images: {len(labels_without_imgs)}")
    if imgs_without_labels:
        for name_orphan in list(imgs_without_labels)[:5]:
            print(f"    ❌ Missing label: {name_orphan}")

    return {
        'dupes': len(dupes),
        'fallback_labels': fallback_count + generic_80_count,
        'class_id_mismatch': expected_id not in set(custom_class_ids.keys()) if expected_id and custom_class_ids else False,
        'orphan_imgs': len(imgs_without_labels),
    }

if __name__ == '__main__':
    results = {}
    for cat in ['DeadAnimalsPollution', 'DamagedElectricalPoles']:
        results[cat] = audit_category(cat)
    
    print(f"\n{'='*60}")
    print(f"  OVERALL SUMMARY")
    print(f"{'='*60}")
    for cat, r in results.items():
        print(f"\n  {cat}:")
        print(f"    Duplicates:        {r['dupes']}")
        print(f"    Fallback labels:   {r['fallback_labels']}")
        print(f"    Class ID mismatch: {'YES ⚠️' if r['class_id_mismatch'] else 'No (remapped at training)'}")
        print(f"    Orphan images:     {r['orphan_imgs']}")
