-- CivicPulse: Fix complaints status check constraint
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Drop the old constraint that doesn't include all needed statuses
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;

-- Add updated constraint with ALL valid statuses
ALTER TABLE complaints ADD CONSTRAINT complaints_status_check 
  CHECK (status IN (
    'submitted',
    'under_review',
    'assigned',
    'in_progress',
    'pending_verification',
    'resolved',
    'rejected',
    'duplicate',
    'escalated'
  ));

-- Verify it worked
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'complaints'::regclass AND contype = 'c';
