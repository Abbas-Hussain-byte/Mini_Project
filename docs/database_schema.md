# CivicPulse — Database Schema

## Supabase PostgreSQL Schema

Run this SQL in Supabase SQL Editor to create all tables.

```sql
-- ============================================================
-- CivicPulse Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. PROFILES (extends Supabase Auth)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin', 'department_head')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), 'citizen');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  head_name TEXT,
  head_email TEXT,
  head_phone TEXT,
  jurisdiction_categories TEXT[] DEFAULT '{}',
  total_workers INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default departments
INSERT INTO departments (name, code, description, jurisdiction_categories) VALUES
  ('Roads & Infrastructure', 'ROADS', 'Handles road damage, potholes, and infrastructure repairs', ARRAY['damaged_road', 'pothole']),
  ('Traffic & Transport', 'TRAFFIC', 'Manages traffic signs, parking violations, and transport issues', ARRAY['illegal_parking', 'broken_road_sign']),
  ('Parks & Environment', 'PARKS', 'Manages trees, green spaces, and environmental issues', ARRAY['fallen_trees']),
  ('Sanitation & Waste', 'SANITATION', 'Handles garbage, littering, and waste management', ARRAY['littering', 'dead_animal']),
  ('Law Enforcement', 'LAW', 'Handles vandalism, graffiti, and public safety', ARRAY['vandalism']),
  ('Public Works & Buildings', 'PUBWORKS', 'Manages concrete structures and public buildings', ARRAY['damaged_concrete']),
  ('Electricity & Power', 'ELECTRICITY', 'Handles electrical wires, poles, and power issues', ARRAY['damaged_electric_wires', 'electricity']),
  ('Water Supply & Drainage', 'WATER', 'Manages water supply, drainage, and sewage', ARRAY['water_supply', 'drainage', 'sewage']),
  ('General Municipal', 'GENERAL', 'Handles miscellaneous and unclassified civic issues', ARRAY['other']);

-- ============================================================
-- 3. COMPLAINTS
-- ============================================================
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected', 'duplicate')),
  image_urls TEXT[] DEFAULT '{}',
  ai_analysis JSONB DEFAULT '{}',
  ai_detected_labels TEXT[] DEFAULT '{}',
  duplicate_of UUID REFERENCES complaints(id) ON DELETE SET NULL,
  cluster_id UUID,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  priority_score DOUBLE PRECISION DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_complaints_user ON complaints(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_severity ON complaints(severity);
CREATE INDEX idx_complaints_department ON complaints(department_id);
CREATE INDEX idx_complaints_location ON complaints(latitude, longitude);
CREATE INDEX idx_complaints_created ON complaints(created_at DESC);

-- ============================================================
-- 4. COMPLAINT EMBEDDINGS
-- ============================================================
CREATE TABLE complaint_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE UNIQUE,
  image_embedding VECTOR(512),
  text_embedding VECTOR(384),
  combined_embedding VECTOR(512),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_embeddings_complaint ON complaint_embeddings(complaint_id);

-- ============================================================
-- 5. CLUSTERS
-- ============================================================
CREATE TABLE clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  centroid_lat DOUBLE PRECISION NOT NULL,
  centroid_lng DOUBLE PRECISION NOT NULL,
  complaint_count INT DEFAULT 0,
  risk_score DOUBLE PRECISION DEFAULT 0,
  dominant_category TEXT,
  bounding_box JSONB,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK now that clusters table exists
ALTER TABLE complaints ADD CONSTRAINT fk_complaints_cluster
  FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- ============================================================
-- 6. COMPLAINT UPDATES (audit trail)
-- ============================================================
CREATE TABLE complaint_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_updates_complaint ON complaint_updates(complaint_id);

-- ============================================================
-- 7. DEPARTMENT ASSIGNMENTS
-- ============================================================
CREATE TABLE department_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assignment_reason TEXT,
  ai_confidence DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'in_progress', 'completed', 'escalated', 'rejected')),
  workers_assigned INT DEFAULT 0,
  assigned_by TEXT DEFAULT 'ai_router',
  deadline TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_assignments_complaint ON department_assignments(complaint_id);
CREATE INDEX idx_assignments_department ON department_assignments(department_id);
CREATE INDEX idx_assignments_status ON department_assignments(status);

-- ============================================================
-- 8. DEPARTMENT WORKERS
-- ============================================================
CREATE TABLE department_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'field_worker' CHECK (role IN ('field_worker', 'supervisor', 'manager')),
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'on_duty', 'on_leave', 'inactive')),
  active_assignments INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workers_department ON department_workers(department_id);

-- ============================================================
-- 9. CCTV STREAMS
-- ============================================================
CREATE TABLE cctv_streams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  stream_type TEXT DEFAULT 'http' CHECK (stream_type IN ('rtsp', 'http', 'hls')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT TRUE,
  last_analysis JSONB DEFAULT '{}',
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ANALYTICS CACHE
-- ============================================================
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_name TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  computed_for DATE DEFAULT CURRENT_DATE,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_metric ON analytics_cache(metric_name);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Complaints: anyone can read, authenticated can create, owner/admin can update
CREATE POLICY "Complaints are viewable by everyone" ON complaints FOR SELECT USING (true);
CREATE POLICY "Auth users can create complaints" ON complaints FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Owners and admins can update complaints" ON complaints FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Updates: viewable by everyone
CREATE POLICY "Updates are viewable by everyone" ON complaint_updates FOR SELECT USING (true);
CREATE POLICY "Auth users can create updates" ON complaint_updates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Assignments: viewable by everyone, admin can modify
CREATE POLICY "Assignments are viewable by everyone" ON department_assignments FOR SELECT USING (true);
CREATE POLICY "Admins can manage assignments" ON department_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'department_head'))
);

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
-- Run in Supabase Dashboard > Storage > Create bucket:
-- Name: complaint-images
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
```
