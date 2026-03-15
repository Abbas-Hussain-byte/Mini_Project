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

module.exports = {
  CATEGORIES,
  SEVERITY_LEVELS,
  COMPLAINT_STATUSES,
  ASSIGNMENT_STATUSES,
  YOLO_LABEL_MAP,
  CATEGORY_TO_DEPARTMENT,
  SEVERITY_DEADLINE_HOURS,
  SEVERITY_COST
};
