-- CivicPulse: Update department_workers role check constraint
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Drop existing constraint
ALTER TABLE department_workers DROP CONSTRAINT IF EXISTS department_workers_role_check;

-- 2. Add updated constraint with all valid roles
ALTER TABLE department_workers ADD CONSTRAINT department_workers_role_check 
  CHECK (role IN (
    'field_worker',
    'supervisor',
    'inspector',
    'technician',
    'manager',
    'admin',
    'staff'
  ));

-- 3. Verify
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'department_workers'::regclass AND contype = 'c';
