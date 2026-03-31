// Category and severity labels used across the platform
const CATEGORIES = [
  'damaged_road',
  'pothole',
  'illegal_parking',
  'broken_road_sign',
  'fallen_trees',
  'littering',
  'vandalism',
  'dead_animal',
  'damaged_concrete',
  'damaged_electric_wires',
  'water_supply',
  'drainage',
  'sewage',
  'electricity',
  'other'
];

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];

const COMPLAINT_STATUSES = [
  'submitted',
  'under_review',
  'assigned',
  'in_progress',
  'pending_verification',  // dept head marks done → awaits admin verification
  'resolved',
  'rejected',
  'duplicate'
];

const ASSIGNMENT_STATUSES = [
  'pending',
  'acknowledged',
  'in_progress',
  'completed',
  'escalated',
  'rejected'
];

// YOLOv8 label index → category mapping
const YOLO_LABEL_MAP = {
  0: 'damaged_road',
  1: 'pothole',
  2: 'illegal_parking',
  3: 'broken_road_sign',
  4: 'fallen_trees',
  5: 'littering',
  6: 'vandalism',
  7: 'dead_animal',
  8: 'damaged_concrete',
  9: 'damaged_electric_wires'
};

// Category → Department code mapping
const CATEGORY_TO_DEPARTMENT = {
  'damaged_road': 'ROADS',
  'pothole': 'ROADS',
  'illegal_parking': 'TRAFFIC',
  'broken_road_sign': 'TRAFFIC',
  'fallen_trees': 'PARKS',
  'littering': 'SANITATION',
  'vandalism': 'LAW',
  'dead_animal': 'SANITATION',
  'damaged_concrete': 'PUBWORKS',
  'damaged_electric_wires': 'ELECTRICITY',
  'electricity': 'ELECTRICITY',
  'water_supply': 'WATER',
  'drainage': 'WATER',
  'sewage': 'WATER',
  'other': 'GENERAL'
};

// Severity → deadline hours mapping
const SEVERITY_DEADLINE_HOURS = {
  'critical': 24,
  'high': 48,
  'medium': 120,    // 5 days
  'low': 240         // 10 days
};

// Estimated cost per severity (for knapsack budget algorithm)
const SEVERITY_COST = {
  'critical': 50000,
  'high': 30000,
  'medium': 15000,
  'low': 5000
};

// Per-category inherent danger score (0.0 - 1.0)
// This drives differentiated priority scoring so dangerous issues
// (electric wires, fallen trees) rank much higher than cosmetic ones (littering)
const CATEGORY_DANGER_SCORE = {
  'damaged_electric_wires': 0.95,
  'fallen_trees': 0.85,
  'damaged_road': 0.70,
  'damaged_concrete': 0.65,
  'pothole': 0.55,
  'broken_road_sign': 0.50,
  'sewage': 0.60,
  'drainage': 0.55,
  'water_supply': 0.50,
  'electricity': 0.90,
  'illegal_parking': 0.30,
  'vandalism': 0.35,
  'dead_animal': 0.40,
  'littering': 0.20,
  'other': 0.30
};

// Categories that are life-threatening / emergency (for disaster response)
const EMERGENCY_CATEGORIES = [
  'damaged_electric_wires',
  'fallen_trees',
  'electricity',
  'damaged_road',
  'damaged_concrete',
  'sewage'
];

module.exports = {
  CATEGORIES,
  SEVERITY_LEVELS,
  COMPLAINT_STATUSES,
  ASSIGNMENT_STATUSES,
  YOLO_LABEL_MAP,
  CATEGORY_TO_DEPARTMENT,
  SEVERITY_DEADLINE_HOURS,
  SEVERITY_COST,
  CATEGORY_DANGER_SCORE,
  EMERGENCY_CATEGORIES
};
