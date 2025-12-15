-- Migration: Fix Population Capacity Modifiers
-- Issue: Settlement creation created modifiers with wrong name ("Housing Capacity") and value (5)
-- Fix: Update all existing modifiers to use correct name ("Population Capacity") and value (2)
-- Date: 2025-12-14
-- BLOCKER 3: Critical bug preventing population capacity calculation

-- Before: Check current state
SELECT 
  sm.id,
  sm.name,
  sm.value,
  sm.description,
  s.name as structure_name
FROM structure_modifiers sm
JOIN settlement_structures ss ON sm.settlement_structure_id = ss.id
JOIN structures s ON ss.structure_id = s.id
WHERE sm.name = 'Housing Capacity';

-- Expected: All TENT structures should show "Housing Capacity" with value 5

-- Migration: Update modifiers to correct values
UPDATE structure_modifiers
SET 
  name = 'Population Capacity',
  value = 2,
  description = 'Provides shelter for 2 people'
WHERE name = 'Housing Capacity';

-- Verify: Check updated state
SELECT 
  sm.id,
  sm.name,
  sm.value,
  sm.description,
  s.name as structure_name
FROM structure_modifiers sm
JOIN settlement_structures ss ON sm.settlement_structure_id = ss.id
JOIN structures s ON ss.structure_id = s.id
WHERE sm.name = 'Population Capacity';

-- Expected: All modifiers should now show "Population Capacity" with value 2

-- Verification Query: Count affected rows
SELECT COUNT(*) as affected_count
FROM structure_modifiers
WHERE name = 'Population Capacity';

-- Expected: Count should match number of settlements created before this fix
