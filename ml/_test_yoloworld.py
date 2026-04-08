from ultralytics import YOLO

try:
    print("Trying YOLO-World...")
    model = YOLO("yolov8s-world.pt")
    model.set_classes(["dead animal", "tangled wires"])
    print("YOLO-World loaded successfully!")
except Exception as e:
    print(f"Error: {e}")
  