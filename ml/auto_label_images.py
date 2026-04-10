import os
import glob
from ultralytics import YOLOWorld

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAGGLE_DIR = os.path.join(PROJECT_ROOT, 'kaggle_archive')

def auto_label():
    try:
        model = YOLOWorld("yolov8s-world.pt")
        print("YOLO-World loaded successfully!")
    except Exception as e:
        print(f"Error loading YOLO-world: {e}")
        return

    mapping = {
        'DeadAnimalsPollution': ['dead animal', 'roadkill'],
        'DamagedElectricalPoles': ['tangled wires', 'hanging electric wire', 'damaged pole']
    }

    labeled_count = 0
    fallback_count = 0

    for category, prompts in mapping.items():
        print(f"\\nEvaluating {category} with prompts {prompts}...")
        model.set_classes(prompts)
        
        target_images_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'images')
        target_labels_dir = os.path.join(KAGGLE_DIR, category, category, 'train', 'labels')
        
        custom_images = glob.glob(os.path.join(target_images_dir, 'custom_real_*.*'))
        print(f"Found {len(custom_images)} custom images in {category}.")
        
        for img_path in custom_images:
            base_name = os.path.basename(img_path)
            label_name = os.path.splitext(base_name)[0] + '.txt'
            label_path = os.path.join(target_labels_dir, label_name)
            
            try:
                # Predict with YOLO-World on CPU to avoid device mismatch errors
                results = model.predict(img_path, conf=0.05, verbose=False, device='cpu')
                boxes = results[0].boxes
                
                if len(boxes) > 0:
                    # Use the bounding box with the highest confidence
                    best_box = boxes[0].xywhn[0].tolist() 
                    with open(label_path, 'w') as f:
                        f.write(f"0 {best_box[0]} {best_box[1]} {best_box[2]} {best_box[3]}\\n")
                    labeled_count += 1
                else:
                    # Fallback to large generic box if YOLO-world sees nothing
                    with open(label_path, 'w') as f:
                        f.write("0 0.5 0.5 0.9 0.9\\n")
                    fallback_count += 1
            except Exception as e:
                print(f"Error predicting {img_path}: {e}")
                
    print(f"\\nDone! Labeled {labeled_count} images accurately using YOLO-world zero-shot detection.")
    print(f"Used generic central-box fallback for {fallback_count} images where YOLO-world couldn't detect the specific objects.")

if __name__ == '__main__':
    auto_label()
