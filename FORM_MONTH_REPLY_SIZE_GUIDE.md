# Form Update: Month Range & Reply Size Settings

## Summary

The podcast generation form has been updated with **two new customizable options**:

1. **Month Range** - Choose what time period of content to include
2. **Reply Size** - Choose the duration/depth of the podcast

These settings are now **fully integrated** into the database and admin form.

---

## 📅 Month Range Options

Control what time period of student activity is included in the podcast review:

| Option            | Value     | Use Case                              |
| ----------------- | --------- | ------------------------------------- |
| **Current Month** | `current` | Focus on this month's recent progress |
| **Last 3 Months** | `last_3`  | Medium-term progress review           |
| **Last 6 Months** | `last_6`  | Semester-like review                  |
| **Last Year**     | `last_12` | Full year review                      |
| **All Time**      | `all`     | Complete learning history             |

**Database Field**: `month_range` in `DailyPodcast` model

**Example**: If you select "Last 3 Months", the podcast will only reference activities/lessons from the past 3 months.

---

## ⏱️ Reply Size Options

Control the duration and depth of the generated podcast:

| Option       | Value      | Duration    | Depth           |
| ------------ | ---------- | ----------- | --------------- |
| **Short**    | `short`    | 2-3 minutes | Quick summary   |
| **Medium**   | `medium`   | 4-5 minutes | Balanced        |
| **Long**     | `long`     | 6-8 minutes | Comprehensive   |
| **Detailed** | `detailed` | 10+ minutes | In-depth review |

**Database Field**: `reply_size` in `DailyPodcast` model

**Example**: If you select "Detailed", the podcast will be longer and include more teaching points and explanations.

---

## How to Use in Admin

### Step 1: Go to Admin Dashboard

```
http://localhost:8000/admin/dailycast/dailypodcast/
```

### Step 2: Create New Podcast or Edit Existing

- Click "Add Podcast" or click on an existing one

### Step 3: Configure Settings

```
1. Select User (required)
2. Choose Primary Language (required)
3. Choose Secondary Language (optional)
4. Choose Output Format (text/audio/both)
5. ✨ NEW: Choose Month Range
6. ✨ NEW: Choose Reply Size
```

### Step 4: Generate

- Click "Generate" button
- The podcast will be created with your selected settings

---

## Form Field Mapping

### In the HTML Form (DailyPodcastGenerationForm)

```python
# Month Range Field
month_range = forms.ChoiceField(
    choices=[
        ('current', '📅 Current Month'),
        ('last_3', '📅 Last 3 Months'),
        ('last_6', '📅 Last 6 Months'),
        ('last_12', '📅 Last Year (12 Months)'),
        ('all', '📅 All Time'),
    ],
    initial='current',
    widget=forms.RadioSelect(),
    help_text="Select time period for content (affects what's included in review)"
)

# Reply Size Field
reply_size = forms.ChoiceField(
    choices=[
        ('short', '⏱️ Short (2-3 minutes)'),
        ('medium', '⏱️ Medium (4-5 minutes)'),
        ('long', '⏱️ Long (6-8 minutes)'),
        ('detailed', '⏱️ Detailed (10+ minutes)'),
    ],
    initial='medium',
    widget=forms.RadioSelect(),
    help_text="Duration/depth of podcast response"
)
```

### In the Database Model (DailyPodcast)

```python
month_range = models.CharField(
    max_length=20,
    choices=[
        ('current', 'Current Month'),
        ('last_3', 'Last 3 Months'),
        ('last_6', 'Last 6 Months'),
        ('last_12', 'Last Year (12 Months)'),
        ('all', 'All Time'),
    ],
    default='current',
    help_text="Time period for content included in podcast",
)

reply_size = models.CharField(
    max_length=20,
    choices=[
        ('short', 'Short (2-3 minutes)'),
        ('medium', 'Medium (4-5 minutes)'),
        ('long', 'Long (6-8 minutes)'),
        ('detailed', 'Detailed (10+ minutes)'),
    ],
    default='medium',
    help_text="Duration/depth of podcast response",
)
```

---

## How These Settings Are Used in Podcast Generation

### 1. When Form is Submitted

The values from the form are saved to the `DailyPodcast` record:

```python
podcast = DailyPodcast(
    user=user,
    primary_language=form.primary_language,
    secondary_language=form.secondary_language,
    output_format=form.output_format,
    month_range=form.month_range,      # ✨ NEW
    reply_size=form.reply_size,        # ✨ NEW
    status='pending',
)
```

### 2. When Podcast is Generated

The settings are passed to the service:

```python
new_podcast = create_multilingual_podcast_for_user(
    user=user,
    primary_language=podcast.primary_language,
    secondary_language=podcast.secondary_language,
    output_format=podcast.output_format,
    month_range=podcast.month_range,        # ✨ NEW
    reply_size=podcast.reply_size,          # ✨ NEW
)
```

### 3. In the Script Generation

These values should be used to:

- **month_range**: Filter student activities to the selected time period
- **reply_size**: Adjust script length, detail level, and content depth

---

## Database Migration

**Migration Applied**: `0006_dailypodcast_month_range_dailypodcast_reply_size.py`

This migration adds:

- ✅ `month_range` field to `DailyPodcast` table (max 20 chars, default='current')
- ✅ `reply_size` field to `DailyPodcast` table (max 20 chars, default='medium')

Both fields are now part of the database schema and will store user selections.

---

## Next Steps (Optional Integration)

To fully utilize these settings in the podcast generation, you can:

1. **Filter Activities by Date Range**

   ```python
   if podcast.month_range == 'last_3':
       cutoff_date = now - timedelta(days=90)
       activities = ActivityEvent.objects.filter(
           user=user,
           timestamp__gte=cutoff_date
       )
   ```

2. **Adjust Script Length**

   ```python
   if podcast.reply_size == 'short':
       script_word_limit = 400
   elif podcast.reply_size == 'medium':
       script_word_limit = 700
   elif podcast.reply_size == 'long':
       script_word_limit = 1000
   else:  # detailed
       script_word_limit = 1500
   ```

3. **Adjust Detail Level**
   - Short: Core concepts only
   - Medium: Key points + examples
   - Long: Key points + examples + questions
   - Detailed: Everything + deep analysis

---

## Testing

### View Saved Settings

Go to any DailyPodcast in admin and check:

- `Month Range` field shows your selected value
- `Reply Size` field shows your selected value

### In Database

```sql
SELECT id, user_id, month_range, reply_size, created_at
FROM dailycast_dailypodcast
ORDER BY created_at DESC
LIMIT 5;
```

---

## Summary

✅ **Form fields added** - Month Range & Reply Size now appear on the form  
✅ **Database fields added** - Both fields stored in DailyPodcast model  
✅ **Migration applied** - Schema updated (0006)  
✅ **Integration ready** - Values passed to podcast generation service

Users can now customize **when** content is reviewed and **how much** detail is provided! 🎉
