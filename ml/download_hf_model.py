"""
Download the fine-tuned Urban Issues Detection YOLO model from HuggingFace.
Source: https://huggingface.co/spaces/AkinduH/Urban-Issues-Detection

This downloads the best.pt weights trained on the same 10-class Urban Issues dataset
used by CivicPulse. The model recognizes:
  damaged_road, pothole, illegal_parking, broken_road_sign, fallen_trees,
  littering, vandalism, dead_animal, damaged_concrete, damaged_electric_wires

Usage:
  python download_hf_model.py
"""

import os
import sys

def download_model():
    """Download the fine-tuned YOLO model from HuggingFace"""
    target_dir = os.path.join(os.path.dirname(__file__), 'models', 'yolo-urban')
    target_path = os.path.join(target_dir, 'best.pt')

    if os.path.exists(target_path):
        size_mb = os.path.getsize(target_path) / (1024 * 1024)
        print(f"✅ Model already exists at {target_path} ({size_mb:.1f} MB)")
        return target_path

    os.makedirs(target_dir, exist_ok=True)

    # Try huggingface_hub first (most reliable)
    try:
        from huggingface_hub import hf_hub_download
        print("📥 Downloading Urban Issues YOLO model from HuggingFace...")
        print("   Source: AkinduH/Urban-Issues-Detection")

        downloaded = hf_hub_download(
            repo_id="AkinduH/Urban-Issues-Detection",
            filename="best.pt",
            repo_type="space",
            local_dir=target_dir,
            local_dir_use_symlinks=False
        )

        # Move to expected path if needed
        if downloaded != target_path and os.path.exists(downloaded):
            import shutil
            shutil.move(downloaded, target_path)

        size_mb = os.path.getsize(target_path) / (1024 * 1024)
        print(f"✅ Model downloaded successfully! ({size_mb:.1f} MB)")
        print(f"   Saved to: {target_path}")
        return target_path

    except ImportError:
        print("⚠️  huggingface_hub not installed. Installing...")
        os.system(f"{sys.executable} -m pip install huggingface_hub")
        # Retry
        from huggingface_hub import hf_hub_download
        print("📥 Downloading Urban Issues YOLO model from HuggingFace...")
        downloaded = hf_hub_download(
            repo_id="AkinduH/Urban-Issues-Detection",
            filename="best.pt",
            repo_type="space",
            local_dir=target_dir,
            local_dir_use_symlinks=False
        )
        if downloaded != target_path and os.path.exists(downloaded):
            import shutil
            shutil.move(downloaded, target_path)
        size_mb = os.path.getsize(target_path) / (1024 * 1024)
        print(f"✅ Model downloaded successfully! ({size_mb:.1f} MB)")
        return target_path

    except Exception as e:
        print(f"❌ Download failed: {e}")
        print("\nManual download instructions:")
        print("  1. Go to https://huggingface.co/spaces/AkinduH/Urban-Issues-Detection/tree/main")
        print("  2. Download 'best.pt'")
        print(f"  3. Place it in: {target_dir}")
        return None


if __name__ == '__main__':
    result = download_model()
    if result:
        print("\n🎯 The ML service will now use this fine-tuned model automatically.")
        print("   Just restart the ML service: python app.py")
    else:
        print("\n⚠️  Model download failed. The ML service will fall back to pretrained YOLOv8n.")
