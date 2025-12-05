-- ============================================================================
-- DIAGNOSTIC QUERIES FOR analytics_activityevent.metadata CORRUPTION
-- ============================================================================
-- This file contains SQL queries to identify rows with invalid JSON metadata.
-- Run these in MySQL/Navicat to find corrupted data.
-- ============================================================================

-- Query 1: Find rows where metadata is not a JSON object (not null, not object)
-- Expected: metadata should always be a JSON object {} or null
SELECT 
    id,
    user_id,
    event_type,
    object_id,
    content_type_id,
    JSON_TYPE(metadata) as metadata_type,
    metadata,
    timestamp,
    created_at
FROM analytics_activityevent
WHERE metadata IS NOT NULL 
  AND JSON_TYPE(metadata) != 'OBJECT'
ORDER BY timestamp DESC
LIMIT 100;

-- Query 2: Count metadata by JSON type
-- This shows the distribution of JSON types in metadata column
SELECT 
    JSON_TYPE(metadata) as metadata_type,
    COUNT(*) as count
FROM analytics_activityevent
GROUP BY JSON_TYPE(metadata)
ORDER BY count DESC;

-- Query 3: Find specific event types with non-object metadata
-- Focus on quiz_answer_submitted events (the problematic type)
SELECT 
    event_type,
    JSON_TYPE(metadata) as metadata_type,
    COUNT(*) as count
FROM analytics_activityevent
WHERE metadata IS NOT NULL 
  AND JSON_TYPE(metadata) != 'OBJECT'
GROUP BY event_type, JSON_TYPE(metadata)
ORDER BY count DESC;

-- Query 4: Sample of corrupted rows with details
-- Shows first 20 corrupted rows with full context
SELECT 
    id,
    user_id,
    event_type,
    object_id,
    content_type_id,
    metadata,
    JSON_TYPE(metadata) as type,
    JSON_VALID(metadata) as is_valid_json,
    timestamp
FROM analytics_activityevent
WHERE metadata IS NOT NULL 
  AND JSON_TYPE(metadata) != 'OBJECT'
ORDER BY id ASC
LIMIT 20;

-- Query 5: Check for numeric metadata (INTEGER, DOUBLE, DECIMAL)
-- These are the types that cause "TypeError: the JSON object must be str, bytes or bytearray, not float"
SELECT 
    id,
    event_type,
    metadata,
    JSON_TYPE(metadata) as metadata_type
FROM analytics_activityevent
WHERE JSON_TYPE(metadata) IN ('INTEGER', 'DOUBLE', 'DECIMAL')
LIMIT 50;

-- Query 6: Total statistics
-- Overall health check of the metadata column
SELECT 
    'Total rows' as metric,
    COUNT(*) as value
FROM analytics_activityevent
UNION ALL
SELECT 
    'Null metadata',
    COUNT(*)
FROM analytics_activityevent
WHERE metadata IS NULL
UNION ALL
SELECT 
    'Valid object metadata',
    COUNT(*)
FROM analytics_activityevent
WHERE JSON_TYPE(metadata) = 'OBJECT'
UNION ALL
SELECT 
    'Corrupted metadata',
    COUNT(*)
FROM analytics_activityevent
WHERE metadata IS NOT NULL AND JSON_TYPE(metadata) != 'OBJECT';

-- ============================================================================
-- CLEANUP QUERY (USE WITH CAUTION)
-- ============================================================================
-- After identifying corrupted rows, you can set them to NULL:

-- -- PREVIEW what would be deleted (run this first):
-- SELECT 
--     id, 
--     event_type, 
--     metadata, 
--     JSON_TYPE(metadata) as type
-- FROM analytics_activityevent
-- WHERE metadata IS NOT NULL 
--   AND JSON_TYPE(metadata) != 'OBJECT';

-- -- ACTUAL CLEANUP (uncomment when ready):
-- -- UPDATE analytics_activityevent
-- -- SET metadata = NULL
-- -- WHERE metadata IS NOT NULL 
-- --   AND JSON_TYPE(metadata) != 'OBJECT';

-- ============================================================================
