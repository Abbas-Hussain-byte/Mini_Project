import os
import time
import requests
from duckduckgo_search import DDGS

# Base directories
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

# Categories and their queries
CATEGORIES = {
    'DeadAnimalsPollution': [
        'dead wild animal on road accident',
        'roadkill animal highway',
        'dead bird street plastic',
        'urban roadkill dead animal pollution'
    ],
    'DamagedElectricalPoles': [
        'damaged electric wires street pole',
        'clustered electric wires mess on pole',
        'live wire hanging on street danger',
        'tangled power lines urban'
    ]
}

def main():
    ddgs = DDGS()
    
    for category, queries in CATEGORIES.items():
        print(f"\\n=== Processing {category} ===")
        
        target_images_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'images')
        target_labels_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'labels')
        
        os.makedirs(target_images_dir, exist_ok=True)
        os.makedirs(target_labels_dir, exist_ok=True)
        
        for query in queries:
            print(f"\\n> Searching and downloading for query: '{query}'")
            try:
                results = ddgs.images(query, max_results=20)
                downloaded = 0
                for r in results:
                    url = r.get('image')
                    if not url: continue
                    
                    try:
                        resp = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
                        if resp.status_code == 200:
                            content_type = resp.headers.get('content-type', '')
                            # Extract ext from URL if possible
                            ext = '.jpg'
                            if 'image/png' in content_type: ext = '.png'
                            elif 'image/webp' in content_type: ext = '.webp'
                            elif url.split('?')[0].lower().endswith('.png'): ext = '.png'
                                
                            base_name = f"custom_real_{int(time.time() * 1000)}_{downloaded}{ext}"
                            target_img_path = os.path.join(target_images_dir, base_name)
                            
                            with open(target_img_path, 'wb') as f:
                                f.write(resp.content)
                                
                            # Create dummy YOLO label (bounding box roughly in center)
                            label_name = os.path.splitext(base_name)[0] + '.txt'
                            target_label_path = os.path.join(target_labels_dir, label_name)
                            
                            with open(target_label_path, 'w') as lf:
                                lf.write("0 0.5 0.5 0.9 0.9\\n")
                            downloaded += 1
                            time.sleep(0.1)
                    except Exception as e:
                        # Silently skip failed image downloads
                        pass
                print(f"Processed {downloaded} images for '{query}'.")
            except Exception as e:
                print(f"Error downloading {query}: {e}")

    print("\\n✅ Additional real-world data downloaded and added to the Kaggle dataset structure!")
    print("You can now re-run `python train_yolo.py` to include these in the model.")

if __name__ == '__main__':
    main()
