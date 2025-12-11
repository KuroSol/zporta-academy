# Metadata Corruption Fix - Production Deployment Plan

## Overview

This document outlines the exact steps to safely diagnose and fix metadata corruption in production, based on the solution developed and tested locally.

---

## Phase 1: LOCAL DIAGNOSIS (Already Complete ✅)

### What We Did Locally

1. **Identified the Problem**

   - Error: `TypeError: the JSON object must be str, bytes or bytearray, not float`
   - Location: `compute_content_difficulty` management command
   - Root cause: Numeric JSON values in `analytics_activityevent.metadata`

2. **Developed Solutions**

   - Refactored command to use raw SQL (bypasses JSONField decoder)
   - Added model validation to prevent future corruption
   - Created diagnostic and cleanup tools

3. **Verified Locally**
   - ✅ Database scan: 0 corrupted rows found
   - ✅ Validation tests: 7/7 pass
   - ✅ Management commands: All working

### Local Test Results

```bash
Database: 4,288 total rows, 0 corrupted
Validation: All 7 tests pass
Commands: compute_content_difficulty ✓, compute_user_abilities ✓, compute_match_scores ✓
```

---

## Phase 2: PRODUCTION DIAGNOSIS (Do This First! 🔍)

### Step 1: Backup Production Database

**CRITICAL: Always backup before any changes**

```bash
# Option A: Full database backup
mysqldump -u [username] -p [database_name] > backup_$(date +%Y%m%d_%H%M%S).sql

# Option B: Just the affected table
mysqldump -u [username] -p [database_name] analytics_activityevent > backup_activityevent_$(date +%Y%m%d_%H%M%S).sql
```

**Store backup in safe location with timestamp**

### Step 2: Deploy Diagnostic Tools Only

**Files to deploy** (read-only, no changes):

1. `intelligence/management/commands/cleanup_invalid_metadata.py`
2. `diagnose_metadata_corruption.sql` (optional, for manual SQL)

**DO NOT deploy model changes yet!**

### Step 3: Run Production Diagnosis

```bash
# SSH into production server
ssh user@production-server

# Navigate to Django project
cd /path/to/django/project

# Activate virtual environment
source venv/bin/activate  # Linux
# OR
venv\Scripts\activate  # Windows

# Run diagnostic in DRY RUN mode (no changes)
python manage.py cleanup_invalid_metadata --dry-run --limit 200
```

### Step 4: Analyze Production Results

**Document the findings:**

| Metric                | Value | Notes |
| --------------------- | ----- | ----- |
| Total rows            | ?     |       |
| Corrupted rows        | ?     |       |
| NULL metadata         | ?     |       |
| Valid OBJECT metadata | ?     |       |
| INTEGER metadata      | ?     |       |
| DOUBLE metadata       | ?     |       |
| STRING metadata       | ?     |       |
| ARRAY metadata        | ?     |       |

**Critical questions:**

1. How many rows are corrupted?

   - 0-10: Safe to proceed
   - 11-100: Review impact
   - 100+: Investigate source before cleanup

2. Which event types are affected?

   - `quiz_answer_submitted`: HIGH PRIORITY (impacts AI)
   - `quiz_completed`: HIGH PRIORITY (impacts completion tracking)
   - `content_viewed`: LOW PRIORITY (analytics only)

3. What is the corruption pattern?
   - All INTEGER? All DOUBLE? Mixed?
   - Recent timestamps or old data?
   - Specific users affected?

**Example output to document:**

```
METADATA CORRUPTION DIAGNOSTIC
================================================================================
Metadata type distribution:
  ✓ OBJECT          45,234 rows
  ○ NULL             8,912 rows
  ✗ INTEGER            156 rows  ← PROBLEM
  ✗ DOUBLE              23 rows  ← PROBLEM

Corrupted metadata by event type:
  • quiz_answer_submitted       INTEGER    142 rows  ← HIGH PRIORITY
  • content_viewed               INTEGER     14 rows  ← LOW PRIORITY
  • quiz_completed               DOUBLE      23 rows  ← HIGH PRIORITY
```

### Step 5: Decision Point

**Based on production findings, choose strategy:**

#### Strategy A: ZERO Corrupted Rows (Like Local)

- ✅ **Action**: Deploy model validation only
- ✅ **Risk**: None
- ✅ **Downtime**: None
- ✅ **Rollback**: Easy (just revert code)

#### Strategy B: 1-50 Corrupted Rows

- ⚠️ **Action**: Deploy fixes + run cleanup
- ⚠️ **Risk**: Low (minimal data affected)
- ⚠️ **Downtime**: 5-10 minutes recommended
- ⚠️ **Rollback**: Medium (need to restore backup if issues)

#### Strategy C: 50-500 Corrupted Rows

- ⚠️ **Action**: Investigate source first, then cleanup
- ⚠️ **Risk**: Medium (significant data affected)
- ⚠️ **Downtime**: 15-30 minutes recommended
- ⚠️ **Rollback**: Required backup

#### Strategy D: 500+ Corrupted Rows

- 🛑 **Action**: STOP - investigate deeply before any changes
- 🛑 **Risk**: High (systemic issue)
- 🛑 **Downtime**: Schedule maintenance window
- 🛑 **Rollback**: Full backup restoration plan needed

---

## Phase 3: PRODUCTION DEPLOYMENT (Only After Diagnosis)

### Deployment Checklist

**Pre-deployment:**

- [ ] Production diagnosis complete (Phase 2)
- [ ] Backup created and verified
- [ ] Decision strategy chosen (A/B/C/D)
- [ ] Stakeholders notified (if downtime needed)
- [ ] Rollback plan prepared
- [ ] Change request approved (if required)

### Deployment Steps by Strategy

#### For Strategy A (Zero Corruption)

**Deploy model validation only:**

1. **Deploy code changes**

   ```bash
   # Pull latest code
   git pull origin main

   # Files changed:
   # - analytics/models.py (added validation)
   # - intelligence/management/commands/compute_content_difficulty.py (raw SQL)
   ```

2. **Restart application**

   ```bash
   # Restart Django/Gunicorn
   sudo systemctl restart gunicorn
   # OR
   sudo supervisorctl restart django
   ```

3. **Verify deployment**

   ```bash
   # Test that management commands work
   python manage.py compute_content_difficulty
   python manage.py compute_user_abilities
   python manage.py compute_match_scores
   ```

4. **Monitor logs**
   ```bash
   tail -f /var/log/django/error.log
   # Watch for ValidationErrors (expected if something tries to write bad metadata)
   ```

**Done! ✅**

#### For Strategy B (1-50 Corrupted Rows)

1. **Enable maintenance mode** (optional but recommended)

   ```bash
   # Create maintenance page
   touch /var/www/maintenance.flag
   # OR use your deployment system's maintenance mode
   ```

2. **Deploy code changes**

   ```bash
   git pull origin main
   sudo systemctl restart gunicorn
   ```

3. **Run cleanup command**

   ```bash
   python manage.py cleanup_invalid_metadata
   # Type 'yes' when prompted
   ```

4. **Verify cleanup**

   ```bash
   # Re-run diagnostic to confirm 0 corrupted rows
   python manage.py cleanup_invalid_metadata --dry-run

   # Should show:
   # "✓ Database is healthy. No metadata corruption detected."
   ```

5. **Test management commands**

   ```bash
   python manage.py compute_content_difficulty
   python manage.py compute_user_abilities
   python manage.py compute_match_scores
   ```

6. **Disable maintenance mode**

   ```bash
   rm /var/www/maintenance.flag
   ```

7. **Monitor application**
   ```bash
   # Watch for errors for 15-30 minutes
   tail -f /var/log/django/error.log
   tail -f /var/log/nginx/access.log
   ```

**Done! ✅**

#### For Strategy C (50-500 Corrupted Rows)

**Additional steps before cleanup:**

1. **Investigate corruption source**

   ```sql
   -- In MySQL, check when corrupted data was created
   SELECT
       DATE(created_at) as date,
       COUNT(*) as corrupted_count
   FROM analytics_activityevent
   WHERE metadata IS NOT NULL
     AND JSON_TYPE(metadata) != 'OBJECT'
   GROUP BY DATE(created_at)
   ORDER BY date DESC;

   -- Check which users are affected
   SELECT
       user_id,
       COUNT(*) as corrupted_count
   FROM analytics_activityevent
   WHERE metadata IS NOT NULL
     AND JSON_TYPE(metadata) != 'OBJECT'
   GROUP BY user_id
   ORDER BY corrupted_count DESC
   LIMIT 20;
   ```

2. **Export corrupted rows for analysis**

   ```sql
   -- Save to CSV for review
   SELECT *
   FROM analytics_activityevent
   WHERE metadata IS NOT NULL
     AND JSON_TYPE(metadata) != 'OBJECT'
   INTO OUTFILE '/tmp/corrupted_metadata.csv'
   FIELDS TERMINATED BY ','
   ENCLOSED BY '"'
   LINES TERMINATED BY '\n';
   ```

3. **Assess data loss impact**

   - Can we recover the original data?
   - Will setting metadata=NULL break anything?
   - Are there dependent systems using this data?

4. **Then follow Strategy B steps**

#### For Strategy D (500+ Rows)

🛑 **DO NOT PROCEED WITHOUT:**

- Root cause analysis complete
- Development team consultation
- Stakeholder approval
- Scheduled maintenance window (at least 2 hours)
- Full backup verified and tested
- Rollback procedure tested

**Contact development team for custom migration plan.**

---

## Phase 4: POST-DEPLOYMENT VERIFICATION

### Immediate Checks (First 30 minutes)

1. **Application health**

   ```bash
   # Check error logs
   tail -f /var/log/django/error.log | grep -i "error\|exception\|traceback"

   # Check response times
   # Monitor APM dashboard (if available)
   ```

2. **Database integrity**

   ```bash
   python manage.py cleanup_invalid_metadata --dry-run
   # Should show: "✓ Database is healthy"
   ```

3. **Management commands**

   ```bash
   python manage.py compute_content_difficulty
   python manage.py compute_user_abilities
   python manage.py compute_match_scores
   # All should complete without errors
   ```

4. **User-facing features**
   - Test quiz submission (creates ActivityEvent with metadata)
   - Test lesson completion
   - Check analytics dashboard
   - Verify AI recommendations (if enabled)

### Extended Monitoring (First 24 hours)

**Watch for:**

- ValidationErrors in logs (indicates something trying to write bad metadata)
- Performance issues with ActivityEvent queries
- User reports of broken features

**Set up alerts for:**

```python
# In your logging config, alert on:
- ValidationError on ActivityEvent
- JSONDecodeError
- TypeError in compute_content_difficulty
```

### Weekly Maintenance (Ongoing)

Add to weekly maintenance checklist:

```bash
# Check for new corruption (should always be 0)
python manage.py cleanup_invalid_metadata --dry-run
```

---

## Rollback Procedures

### If Deployment Fails (Strategy A)

**Simple code revert:**

```bash
# Revert to previous commit
git revert HEAD
sudo systemctl restart gunicorn

# OR
git reset --hard [previous-commit-hash]
sudo systemctl restart gunicorn
```

**Impact**: None (no data changes)

### If Cleanup Fails (Strategy B/C)

**Restore from backup:**

```bash
# Stop application
sudo systemctl stop gunicorn

# Restore table
mysql -u [username] -p [database] < backup_activityevent_[timestamp].sql

# Restart application
sudo systemctl start gunicorn

# Verify restoration
python manage.py cleanup_invalid_metadata --dry-run
```

**Impact**: Loses events created during deployment window

### If Production Broken After Cleanup

**Emergency procedure:**

```bash
# 1. Enable maintenance mode
touch /var/www/maintenance.flag

# 2. Restore full database backup
mysql -u [username] -p [database] < backup_[timestamp].sql

# 3. Revert code changes
git reset --hard [previous-commit-hash]
sudo systemctl restart gunicorn

# 4. Verify health
python manage.py check
python manage.py migrate --check

# 5. Disable maintenance mode
rm /var/www/maintenance.flag

# 6. Contact development team
```

---

## Communication Templates

### Pre-Deployment Notification

**Subject**: [Scheduled Maintenance] Metadata Integrity Fix - [Date] [Time]

**Body**:

```
Hi Team,

We will be performing a database integrity fix on [DATE] at [TIME] [TIMEZONE].

What: Fix metadata corruption in activity tracking system
Duration: Approximately [15-30] minutes
Impact: [No user impact / Brief downtime / Limited feature availability]
Affected Features: [Quiz analytics, AI recommendations, etc.]

Actions Required:
- [None / Avoid quiz submissions during maintenance window]

Rollback Plan: Full database backup available for immediate restoration if needed.

Contact: [Your contact info] for questions or issues.

Thank you,
[Your name]
```

### Post-Deployment Success

**Subject**: [Complete] Metadata Integrity Fix Successfully Deployed

**Body**:

```
Hi Team,

The metadata integrity fix has been successfully deployed.

Results:
- Corrupted rows cleaned: [X]
- Validation added: ✅
- All systems verified: ✅

Current Status:
- Application: Healthy
- Database: Healthy (0 corrupted rows)
- Management commands: All operational

Next Steps:
- Continue monitoring logs for 24 hours
- Weekly integrity checks scheduled

Thank you,
[Your name]
```

### Post-Deployment Issue

**Subject**: [Alert] Metadata Fix Rollback Required

**Body**:

```
Hi Team,

We encountered an issue during the metadata fix deployment and have rolled back.

Issue: [Brief description]
Action Taken: Restored from backup at [timestamp]
Current Status: Application restored to pre-deployment state

Next Steps:
1. Investigate root cause: [ETA]
2. Plan revised deployment: [ETA]
3. Team meeting: [Time]

All systems are currently operational.

Thank you,
[Your name]
```

---

## Checklist: Production Deployment

**Phase 1: Preparation**

- [ ] Local fix verified working
- [ ] Documentation reviewed
- [ ] Team notified of planned work
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan prepared

**Phase 2: Diagnosis**

- [ ] Production backup created
- [ ] Backup verified (can be restored)
- [ ] Diagnostic command deployed
- [ ] Production scan completed
- [ ] Results documented
- [ ] Strategy chosen (A/B/C/D)
- [ ] Stakeholders approve plan

**Phase 3: Deployment**

- [ ] Maintenance mode enabled (if required)
- [ ] Code deployed
- [ ] Application restarted
- [ ] Cleanup run (if required)
- [ ] Verification tests passed
- [ ] Maintenance mode disabled

**Phase 4: Verification**

- [ ] Error logs clean (30 min)
- [ ] Management commands tested
- [ ] User features verified
- [ ] Performance normal
- [ ] 24-hour monitoring setup

**Phase 5: Documentation**

- [ ] Deployment notes saved
- [ ] Team notified of success
- [ ] Monitoring dashboard updated
- [ ] Weekly checks scheduled
- [ ] Lessons learned documented

---

## Summary: LOCAL vs PRODUCTION Workflow

| Phase         | Local (Development)               | Production                       |
| ------------- | --------------------------------- | -------------------------------- |
| **Discovery** | ✅ Found issue via error logs     | 🔍 Run diagnostic first          |
| **Diagnosis** | ✅ Scanned database (0 corrupted) | 🔍 Must scan production DB       |
| **Solution**  | ✅ Developed & tested fixes       | ⏳ Deploy based on findings      |
| **Testing**   | ✅ Verified all commands work     | ⏳ Test after deployment         |
| **Cleanup**   | ✅ Not needed (0 corrupted)       | ❓ TBD based on scan             |
| **Risk**      | None (dev environment)            | Variable (depends on corruption) |

**Key Principle**:

> **Never assume production matches local!**  
> Always diagnose production first, then act based on actual findings.

---

## Contact & Escalation

**For deployment questions:**

- Development Team: [Contact]
- DevOps Team: [Contact]
- Database Admin: [Contact]

**Escalation path:**

1. First: Check this document
2. Then: Run diagnostic to gather data
3. Then: Contact development team with findings
4. Finally: Escalate to senior engineer if Strategy D

**Emergency contacts** (if production broken):

- On-call Engineer: [Phone/Slack]
- Database Emergency: [Phone/Slack]
- Management: [Phone/Slack]

---

**Document Version**: 1.0  
**Last Updated**: 2024-12-05  
**Author**: Development Team  
**Status**: Ready for Production Use
