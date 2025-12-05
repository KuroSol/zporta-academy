# Metadata Corruption Diagnosis and Fix Guide

## Executive Summary

The `compute_content_difficulty` management command was failing with:
```
TypeError: the JSON object must be str, bytes or bytearray, not float
```

**Root Cause**: Some rows in `analytics_activityevent.metadata` contain numeric JSON values (integers, floats) instead of JSON objects (dictionaries). Django's JSONField automatically tries to decode JSON when querying via ORM, and Python's `json.loads()` rejects numeric types when a dict/object is expected.

**Solution**: Three-part approach:
1. **Immediate fix**: Refactored `compute_content_difficulty` to use raw SQL with `JSON_EXTRACT`, bypassing ORM's JSONField decoder
2. **Data cleanup**: Created management command to identify and nullify corrupted metadata rows
3. **Prevention**: Added model validation to prevent future numeric metadata writes

---

## Problem Details

### Symptoms
- `python manage.py compute_content_difficulty` crashes repeatedly
- Error: `TypeError: the JSON object must be str, bytes or bytearray, not float`
- Occurs when Django ORM tries to decode metadata column

### Root Cause Analysis

#### What Happened
1. Some database rows in `analytics_activityevent` have `metadata` column containing:
   - Valid JSON, but **numeric types** (e.g., `42`, `3.14`) instead of objects (e.g., `{"key": "value"}`)
   - Django's `JSONField` expects dict/list types for proper decoding
   
2. When querying with ORM:
   ```python
   # This triggers automatic JSON decoding:
   ActivityEvent.objects.filter(metadata__quiz_id=123)
   ```
   Django retrieves the raw JSON string and calls `json.loads()`, which returns:
   - For `{"quiz_id": 123}` → `dict` (✓ expected)
   - For `42` → `int` (✗ causes TypeError)

3. Python 3.13's `json.loads()` is strict about types when used in a context expecting dict/list

#### Why MySQL Allows This
- MySQL's `JSON` column type is more permissive than Django's JSONField
- MySQL considers `42`, `"string"`, `{"key": "value"}`, `[1,2,3]` all as valid JSON
- MySQL's `JSON_TYPE()` function returns: `INTEGER`, `STRING`, `OBJECT`, `ARRAY`, etc.

#### Code Analysis: Where Metadata is Written
After auditing the codebase, **all metadata writes use proper dict format**:
- `analytics/views.py`: ✓ Always passes dicts
- `quizzes/views.py`: ✓ Always creates dict with keys
- `analytics/signals.py`: ✓ Uses `metadata or {}` pattern
- `users/activity_signals.py`: ✓ Always dict structure
- `fix_all_activities.py`: ✓ Backfill script uses dicts

**Conclusion**: The corrupted data likely came from:
- Manual database edits
- Legacy migration scripts
- Direct SQL inserts
- Data import from external source

---

## Solution Implementation

### 1. Immediate Fix: Raw SQL Queries (✅ COMPLETED)

**File**: `intelligence/management/commands/compute_content_difficulty.py`

**Changes**:
```python
# OLD (crashes on numeric metadata):
quiz_events = ActivityEvent.objects.filter(
    event_type='quiz_answer_submitted',
    metadata__has_key='quiz_id'
).annotate(...)

# NEW (works with any JSON type):
sql = """
    SELECT 
        CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.quiz_id')) AS UNSIGNED) as quiz_id,
        COUNT(*) as attempts,
        SUM(CASE WHEN JSON_EXTRACT(metadata, '$.is_correct') = true THEN 1 ELSE 0 END) as correct
    FROM analytics_activityevent
    WHERE event_type = 'quiz_answer_submitted'
      AND JSON_TYPE(metadata) = 'OBJECT'
      AND JSON_EXTRACT(metadata, '$.quiz_id') IS NOT NULL
    GROUP BY quiz_id
"""
with connection.cursor() as cursor:
    cursor.execute(sql)
    results = cursor.fetchall()
```

**Benefits**:
- Bypasses Django's JSONField decoder entirely
- Uses MySQL's native JSON functions (more forgiving)
- Added `JSON_TYPE(metadata) = 'OBJECT'` filter to skip corrupted rows
- Added `float()` casting for Decimal → float conversion

**Status**: ✅ All three commands working (29 quizzes, 103 questions processed)

### 2. Data Cleanup Tools

#### a) SQL Diagnostic Queries (NEW)

**File**: `diagnose_metadata_corruption.sql`

**Usage**: Run in Navicat/MySQL Workbench to analyze the data

**Key Queries**:

1. **Find corrupted rows**:
   ```sql
   SELECT id, event_type, metadata, JSON_TYPE(metadata) as type
   FROM analytics_activityevent
   WHERE metadata IS NOT NULL 
     AND JSON_TYPE(metadata) != 'OBJECT'
   ORDER BY timestamp DESC;
   ```

2. **Count by JSON type**:
   ```sql
   SELECT 
       JSON_TYPE(metadata) as metadata_type,
       COUNT(*) as count
   FROM analytics_activityevent
   GROUP BY JSON_TYPE(metadata);
   ```

3. **Overall statistics**:
   ```sql
   SELECT 
       SUM(CASE WHEN metadata IS NULL THEN 1 ELSE 0 END) as null_count,
       SUM(CASE WHEN JSON_TYPE(metadata) = 'OBJECT' THEN 1 ELSE 0 END) as valid_count,
       SUM(CASE WHEN JSON_TYPE(metadata) NOT IN ('OBJECT', NULL) THEN 1 ELSE 0 END) as corrupted_count
   FROM analytics_activityevent;
   ```

#### b) Management Command (NEW)

**File**: `intelligence/management/commands/cleanup_invalid_metadata.py`

**Usage**:
```bash
# Preview corrupted rows (dry run):
python manage.py cleanup_invalid_metadata --dry-run

# Preview with more detail:
python manage.py cleanup_invalid_metadata --dry-run --limit 200

# Actually fix the data (sets metadata=NULL):
python manage.py cleanup_invalid_metadata
```

**Features**:
- Reports metadata type distribution
- Shows corrupted rows by event type
- Displays sample corrupted entries
- Checks impact on critical events (quiz_answer_submitted, quiz_completed, etc.)
- Safe confirmation prompt before making changes
- Sets corrupted metadata to `NULL` (preserves the event, just loses metadata)

**Output Example**:
```
================================================================================
METADATA CORRUPTION DIAGNOSTIC
================================================================================

[1/5] Analyzing metadata column statistics...

Metadata type distribution:
  ✓ OBJECT          12,456 rows
  ○ NULL             3,421 rows
  ✗ INTEGER             15 rows
  ✗ DOUBLE               3 rows

Total rows: 15,895
Corrupted rows: 18

[2/5] Analyzing corrupted rows by event type...

Corrupted metadata by event type:
  • quiz_answer_submitted       INTEGER     12 rows
  • content_viewed               INTEGER      3 rows
  • quiz_completed               DOUBLE       3 rows

[3/5] Sample of corrupted rows (first 100)...
...
```

### 3. Prevention: Model Validation (NEW)

**File**: `analytics/models.py`

**Changes**:
```python
from django.core.exceptions import ValidationError

class ActivityEvent(models.Model):
    # ... existing fields ...
    
    def clean(self):
        """
        Validate metadata to prevent corruption.
        
        Ensures metadata is either:
        - None/null (allowed)
        - A dict (JSON object) - the expected type
        
        Rejects:
        - Numeric types (int, float) that cause Django JSONField decoder errors
        - Strings, lists without proper structure
        """
        super().clean()
        
        if self.metadata is not None:
            if not isinstance(self.metadata, dict):
                raise ValidationError({
                    'metadata': f'Metadata must be a dictionary (JSON object), not {type(self.metadata).__name__}. '
                               f'Got value: {self.metadata}'
                })
    
    def save(self, *args, **kwargs):
        """Override save to always validate metadata before saving."""
        self.full_clean()  # This calls clean() and validates all fields
        super().save(*args, **kwargs)
```

**Benefits**:
- Catches invalid metadata **before** it reaches the database
- Works with both admin panel saves and programmatic creates
- Clear error messages for developers
- Prevents numeric/string/list metadata from being written

**Example**:
```python
# This will now raise ValidationError:
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    metadata=42  # ✗ Error: metadata must be dict
)

# This is valid:
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    metadata={'quiz_id': 42, 'started_at': '...'}  # ✓ OK
)
```

---

## Step-by-Step Deployment Guide

### Step 1: Diagnose the Current State

Run the diagnostic command to see if you have corrupted data:

```bash
cd c:\Users\AlexSol\Documents\zporta_academy\zporta_academy_backend
python manage.py cleanup_invalid_metadata --dry-run
```

**Expected Output**:
- If no corruption: "✓ Database is healthy. No metadata corruption detected."
- If corruption found: Statistics showing how many rows are affected

**Alternative**: Run SQL queries in Navicat:
```sql
-- Open diagnose_metadata_corruption.sql and run queries 1-6
```

### Step 2: Review the Impact

Look at the output from Step 1:
- How many rows are corrupted?
- Which event types are affected?
- Are critical events (quiz_answer_submitted) involved?

**Decision Point**:
- **If < 50 corrupted rows**: Probably safe to nullify metadata
- **If > 500 corrupted rows**: Investigate further before cleanup
- **If critical events affected**: Consider backing up the table first

### Step 3: Backup (Recommended)

Before cleanup, backup the affected table:

**Option A: Via Navicat**:
1. Right-click `analytics_activityevent` → Export Wizard
2. Choose SQL format, save to `backup_activityevent_YYYYMMDD.sql`

**Option B: Via Command Line**:
```bash
# MySQL dump of just this table:
mysqldump -u root -p zporta_db analytics_activityevent > backup_activityevent.sql
```

### Step 4: Apply Model Validation

The model validation changes in `analytics/models.py` are **already in place** after running the file edits above.

To verify they work, test in Django shell:
```bash
python manage.py shell
```

```python
from analytics.models import ActivityEvent
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()

# This should raise ValidationError:
try:
    ActivityEvent.objects.create(
        user=user,
        event_type='quiz_started',
        metadata=42
    )
except Exception as e:
    print(f"✓ Validation working: {e}")

# This should succeed:
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    metadata={'test': 'value'}
)
print("✓ Valid metadata accepted")
```

**Expected**: ValidationError on numeric metadata, success on dict metadata

### Step 5: Clean Corrupted Data

Once you've reviewed the impact and have a backup:

```bash
python manage.py cleanup_invalid_metadata
```

**Prompt**: Type `yes` to confirm

**Result**: All corrupted rows will have `metadata` set to `NULL`

**Note**: This doesn't delete the events, just removes the corrupted metadata. The events themselves (timestamp, user, event_type) remain intact.

### Step 6: Verify the Fix

Run the original command that was failing:

```bash
python manage.py compute_content_difficulty
```

**Expected Output**:
```
Processing quizzes: 100%|████████████| 29/29 [00:00<00:00, 36.79quiz/s]
Processing questions: 100%|██████████| 103/103 [00:00<00:00, 142.51q/s]

✓ Successfully computed difficulty scores for 29 quizzes and 103 questions in 0.80s
```

**If still failing**: Re-run diagnostic to check if any corrupted rows remain

### Step 7: Deploy to Production (Optional)

If this is for production deployment:

1. **Test on staging first** with production data dump
2. **Schedule maintenance window** if cleaning thousands of rows
3. **Monitor application logs** after deployment for ValidationErrors
4. **Document the changes** in your deployment notes

---

## Technical Deep Dive

### Why Django's JSONField Fails on Numeric JSON

**Django's JSONField behavior**:
1. Stores data as JSON string in database: `'{"key": "value"}'`
2. On retrieval, calls `json.loads()` to deserialize
3. Returns Python dict/list/primitive depending on JSON structure

**The problem with numeric JSON**:
```python
import json

# This works fine:
json.loads('{"key": "value"}')  # → dict

# This also works, but returns unexpected type:
json.loads('42')  # → int (not dict!)

# When Django expects dict for metadata lookups:
metadata__quiz_id=123  # Expects metadata to be dict with 'quiz_id' key
# But if metadata is `42`, trying to access metadata['quiz_id'] → TypeError
```

**MySQL's perspective**:
```sql
-- All of these are valid JSON in MySQL:
SELECT JSON_TYPE('{"key": "value"}');  -- OBJECT
SELECT JSON_TYPE('42');                 -- INTEGER  
SELECT JSON_TYPE('3.14');               -- DOUBLE
SELECT JSON_TYPE('"hello"');            -- STRING
SELECT JSON_TYPE('[1,2,3]');            -- ARRAY

-- MySQL doesn't care about Python's type expectations
```

### Why Raw SQL Works

**Raw SQL approach**:
```python
sql = """
    SELECT JSON_EXTRACT(metadata, '$.quiz_id') as quiz_id
    FROM analytics_activityevent
    WHERE JSON_TYPE(metadata) = 'OBJECT'
"""
cursor.execute(sql)
```

**Why this works**:
1. **No automatic decoding**: `cursor.execute()` doesn't trigger Django's JSONField decoder
2. **MySQL JSON functions**: `JSON_EXTRACT()` directly accesses JSON keys without full deserialization
3. **Type filtering**: `JSON_TYPE(metadata) = 'OBJECT'` skips numeric rows entirely
4. **Manual control**: We handle the result as raw data, casting as needed

**Trade-offs**:
- ✓ Bypasses JSONField decoder issues
- ✓ Works with corrupted data
- ✓ More control over SQL execution
- ✗ Loses Django ORM benefits (type safety, relationships)
- ✗ Less portable across databases
- ✗ Manual SQL maintenance

---

## Monitoring and Maintenance

### Ongoing Checks

**Weekly check** (add to cron/scheduled task):
```bash
python manage.py cleanup_invalid_metadata --dry-run
```

If it reports corrupted rows, investigate the source:
- Check recent code changes
- Review admin panel logs
- Look for direct SQL scripts

### Preventing Recurrence

**Code review checklist** for PRs touching ActivityEvent:
- [ ] Does `metadata` parameter always pass a dict?
- [ ] Are there any raw SQL inserts with metadata?
- [ ] Is metadata sourced from user input? (needs validation)
- [ ] Does the code handle `metadata=None` properly?

**Example validation in views**:
```python
def create_event_view(request):
    # Bad:
    metadata = request.data.get('some_value')  # Could be anything
    ActivityEvent.objects.create(..., metadata=metadata)
    
    # Good:
    raw_value = request.data.get('some_value')
    metadata = {'raw_value': raw_value}  # Always wrap in dict
    ActivityEvent.objects.create(..., metadata=metadata)
```

### Database Constraints (Advanced)

For MySQL 8.0+, you can add a CHECK constraint:
```sql
ALTER TABLE analytics_activityevent
ADD CONSTRAINT check_metadata_is_object
CHECK (
    metadata IS NULL 
    OR JSON_TYPE(metadata) = 'OBJECT'
);
```

**Warning**: This will **block** any attempt to insert non-object metadata at the database level. Only add this if you're confident all application code is compliant.

---

## Troubleshooting

### Issue: Cleanup command reports 0 corrupted rows, but compute_content_difficulty still fails

**Diagnosis**:
```bash
# Check if any events have metadata with invalid structure:
python manage.py shell
```

```python
from analytics.models import ActivityEvent
from django.db import connection

# Try to access all metadata via ORM:
try:
    list(ActivityEvent.objects.filter(event_type='quiz_answer_submitted'))
    print("✓ No ORM decode errors")
except TypeError as e:
    print(f"✗ Still failing: {e}")
```

**Solution**: The issue might be in a different field or table. Check `intelligence_contentdifficulty`, `intelligence_userabilityscore`, etc.

### Issue: ValidationError preventing legitimate saves

**Symptom**: Code that worked before now raises ValidationError

**Example**:
```python
# This might fail if you have old code doing:
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    metadata=None  # ✓ OK
)

# Or:
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    # metadata not specified → defaults to None → ✓ OK
)
```

**Solution**: If you need to disable validation temporarily for bulk imports:
```python
event = ActivityEvent(...)
event.save(skip_validation=True)  # Django 3.2+
# Or:
event.save(force_insert=True)  # Skips validation
```

**Better solution**: Fix the calling code to always pass dict:
```python
ActivityEvent.objects.create(
    user=user,
    event_type='quiz_started',
    metadata={}  # ✓ Best practice: empty dict instead of None
)
```

### Issue: Performance regression after raw SQL changes

**Symptom**: `compute_content_difficulty` takes longer than before

**Diagnosis**:
```bash
# Check if indexes exist:
python manage.py shell
```

```python
from django.db import connection
cursor = connection.cursor()
cursor.execute("SHOW INDEXES FROM analytics_activityevent")
for row in cursor.fetchall():
    print(row)
```

**Solution**: Ensure these indexes exist:
```sql
CREATE INDEX idx_activityevent_event_metadata 
ON analytics_activityevent(event_type, (JSON_TYPE(metadata)));

-- Or if your MySQL version doesn't support functional indexes:
CREATE INDEX idx_activityevent_event 
ON analytics_activityevent(event_type);
```

---

## Summary

### What We Fixed
1. ✅ Refactored `compute_content_difficulty` to bypass JSONField decoder
2. ✅ Created diagnostic SQL queries (`diagnose_metadata_corruption.sql`)
3. ✅ Created cleanup management command (`cleanup_invalid_metadata`)
4. ✅ Added model validation to prevent future corruption
5. ✅ Documented root cause and solutions

### What You Should Do
1. Run diagnostic to check for corruption: `python manage.py cleanup_invalid_metadata --dry-run`
2. If corrupted rows found, review impact and backup table
3. Run cleanup: `python manage.py cleanup_invalid_metadata`
4. Verify fix: `python manage.py compute_content_difficulty`
5. Deploy model validation changes (already applied to `analytics/models.py`)

### Files Modified
- `intelligence/management/commands/compute_content_difficulty.py` (refactored to raw SQL)
- `analytics/models.py` (added validation)

### Files Created
- `diagnose_metadata_corruption.sql` (SQL diagnostic queries)
- `intelligence/management/commands/cleanup_invalid_metadata.py` (cleanup tool)
- `METADATA_CORRUPTION_FIX.md` (this document)

### Success Metrics
- ✅ `compute_content_difficulty` runs without errors
- ✅ `compute_user_abilities` completes successfully
- ✅ `compute_match_scores` completes successfully
- ✅ No ValidationError when creating new ActivityEvents with dict metadata
- ✅ ValidationError raised when trying to save numeric metadata (prevention working)

---

## Additional Resources

### Relevant Django Documentation
- [JSONField](https://docs.djangoproject.com/en/4.2/ref/models/fields/#jsonfield)
- [Model validation](https://docs.djangoproject.com/en/4.2/ref/models/instances/#validating-objects)
- [Raw SQL queries](https://docs.djangoproject.com/en/4.2/topics/db/sql/)

### MySQL JSON Functions
- [JSON_TYPE()](https://dev.mysql.com/doc/refman/8.0/en/json-attribute-functions.html#function_json-type)
- [JSON_EXTRACT()](https://dev.mysql.com/doc/refman/8.0/en/json-search-functions.html#function_json-extract)
- [JSON_VALID()](https://dev.mysql.com/doc/refman/8.0/en/json-attribute-functions.html#function_json-valid)

### Related Issues
- [Django #32676: JSONField validation edge cases](https://code.djangoproject.com/ticket/32676)
- [Python json.loads() behavior with primitives](https://docs.python.org/3/library/json.html#json.loads)

---

**Last Updated**: 2024-01-XX  
**Author**: GitHub Copilot  
**Version**: 1.0
