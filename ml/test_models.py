import requests
import json
import time

API_URL = "http://localhost:8000"

def test_health():
    print("=========================================")
    print("--- 1. Testing ML API Health ---")
    print("=========================================")
    try:
        response = requests.get(f"{API_URL}/health")
        print(json.dumps(response.json(), indent=2))
        return True
    except requests.exceptions.ConnectionError:
        print("❌ ML Service is not running! Please start it first with:")
        print("   cd ml")
        print("   python app.py")
        return False

def test_text_classification():
    print("\n=========================================")
    print("--- 2. Testing Text Classification ---")
    print("=========================================")
    texts = [
        "There is a huge pothole on MG Road causing accidents.",
        "Garbage has not been collected for a week near the park.",
        "The electric pole wires are exposed and sparking!"
    ]
    
    for text in texts:
        print(f"\nInput Text: '{text}'")
        response = requests.post(
            f"{API_URL}/ml/classify-text",
            json={"text": text}
        )
        if response.status_code == 200:
            res = response.json()
            print(f"🎯 Predicted Category: {res.get('category')} (Confidence: {res.get('confidence')})")
            print(f"🔴 Severity: {res.get('severity')}")
            print(f"🧠 Model used: {res.get('model', 'Unknown')}")
            
            if res.get('model') == 'zeroshot-distilbert':
                print("   ⚠️ WARNING: Still using the untrained zero-shot model.")
                print("      For high accuracy, you must run: python train_all.py")
            elif res.get('model') == 'finetuned-distilbert':
                print("   ✅ SUCCESS: Using the fine-tuned highly accurate model!")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")

def test_image_and_text():
    print("\n=========================================")
    print("--- 3. Testing Complete Analysis (Image + Text) ---")
    print("=========================================")
    # A dummy URL of a pothole
    image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Large_pothole_on_a_city_street.jpg/800px-Large_pothole_on_a_city_street.jpg"
    text = "Reporting this large crater on the road."
    
    print(f"Image URL: {image_url}")
    print(f"Text Input: '{text}'")
    print("Analyzing... (this may take a few seconds on first run)")
    
    response = requests.post(
        f"{API_URL}/ml/analyze-complete",
        json={"image_url": image_url, "text": text}
    )
    
    if response.status_code == 200:
        res = response.json()
        print(f"\n🎯 Overall Category: {res.get('category')}")
        print(f"📝 Generated Title: {res.get('title')}")
        print(f"🔴 Severity: {res.get('severity')}")
        
        detections = res.get('detections', [])
        print(f"\n👁️ YOLO Detections ({len(detections)} found):")
        for d in detections:
            print(f"   - {d['label']} (Confidence: {d['confidence']*100:.1f}%)")
        
        if not detections:
            print("\n   ⚠️ No visual detections found in the image.")
            print("      Note: Pretrained YOLOv8n doesn't know urban issues well.")
            print("      To fix this, train the model using: python train_all.py")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")

if __name__ == '__main__':
    print("🤖 CivicPulse ML Model Verification Script 🤖")
    print("Make sure your ML service is running in another terminal before starting!\n")
    
    if test_health():
        time.sleep(1)
        test_text_classification()
        time.sleep(1)
        test_image_and_text()
        
    print("\n=========================================")
    print("Finished Testing!")
