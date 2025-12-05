# Intelligence App - AI-Powered Ranking & Recommendation System

## Overview

The `intelligence` app provides AI-driven personalization for the Zporta Academy platform. It implements:

- **User Ability Profiling**: ELO-style ratings to measure student competency
- **Content Difficulty Scoring**: Data-driven difficulty assessment for quizzes/questions
- **Match Score Computation**: Intelligent matching between users and content
- **Personalized Learning Paths**: Optimized content sequences for each learner

All heavy ML computations run **offline** via management commands. API endpoints return precomputed data for <20ms response times.

---

## Architecture

### Data Flow

```
User Activity (ActivityEvent) 
    ↓
[Offline Batch Jobs] (Management Commands)
    ↓
Intelligence Models (UserAbilityProfile, ContentDifficultyProfile, MatchScore)
    ↓
[API Endpoints] (<20ms lookups)
    ↓
Frontend (AI Dashboard, Enhanced Feed)
```

### Key Design Principles

1. **Offline Heavy, Online Light**: All ML inference and scoring happens in background jobs
2. **Backward Compatible**: Graceful fallback to classic feed logic if AI data unavailable
3. **Safe Migrations**: All new fields are nullable with defaults
4. **Performance First**: Extensive indexing, denormalization for hot paths
5. **SEO Safe**: No impact on SSR performance for public pages

---

## Models

### 1. UserAbilityProfile

Stores computed ability estimates for each user.

**Fields:**
- `overall_ability_score` (FloatField, 0-1000 scale): ELO-style rating
- `ability_by_subject` (JSONField): Per-subject ability breakdowns
- `ability_by_tag` (JSONField): Per-tag ability (optional)
- `total_quizzes_attempted` (IntegerField): Confidence metric
- `recent_performance_trend` (FloatField): 30-day performance change
- `global_rank` (IntegerField): User's rank among all users
- `percentile` (FloatField): Percentile ranking (0-100)

**Computed by:** `compute_user_abilities` management command

**Updated:** Daily or every 12 hours

### 2. ContentDifficultyProfile

Stores computed difficulty scores for quizzes and questions.

**Fields:**
- `content_type` / `object_id` (GenericFK): Points to Quiz or Question
- `computed_difficulty_score` (FloatField, 0-1000): Difficulty on same scale as ability
- `success_rate` (FloatField): Overall correctness percentage
- `avg_time_spent_seconds` (FloatField): Average completion time
- `attempt_count` (IntegerField): Total attempts (for confidence)
- `difficulty_by_user_segment` (JSONField): Segmented difficulty

**Computed by:** `compute_content_difficulty` management command

**Updated:** Daily

### 3. MatchScore

Precomputed user-content match scores for fast feed generation.

**Fields:**
- `user` (FK): The student
- `content_type` / `object_id` (GenericFK): The quiz/lesson
- `match_score` (FloatField, 0-100): Overall match quality
- `difficulty_gap` (FloatField): `content_difficulty - user_ability`
- `zpd_score` (FloatField): Zone of Proximal Development score
- `preference_alignment_score` (FloatField): Matches user interests
- `topic_similarity_score` (FloatField): Semantic similarity (optional)
- `recency_penalty` (FloatField): Recently attempted penalty

**Computed by:** `compute_match_scores` management command

**Updated:** Every 6-12 hours

### 4. RecommendationCache (Optional)

Denormalized cache for entire user feeds.

**Fields:**
- `user` (FK)
- `feed_type` (CharField): 'personalized', 'review', 'explore', 'challenge'
- `cached_quiz_ids` (JSONField): Ordered quiz IDs
- `cached_metadata` (JSONField): Pre-serialized explanations
- `expires_at` (DateTimeField): TTL

**Purpose:** Ultra-fast feed serving (optional optimization)

---

## Management Commands

### 1. compute_content_difficulty

Computes difficulty scores for all quizzes and questions.

**Usage:**
```bash
python manage.py compute_content_difficulty --min-attempts 3 --days 90
```

**Options:**
- `--min-attempts`: Minimum attempts required (default: 3)
- `--days`: Number of days of history (default: 90)
- `--content-type`: `quiz`, `question`, or `all` (default: all)

**What it does:**
1. Analyzes `ActivityEvent` data for quiz/question attempts
2. Computes difficulty based on success rate, time spent, attempt count
3. Updates `ContentDifficultyProfile` and denormalized fields on Quiz/Question models

**Performance:** ~5-10 minutes for thousands of items

**Schedule:** Daily at 2 AM

---

### 2. compute_user_abilities

Computes ability scores and rankings for all users.

**Usage:**
```bash
python manage.py compute_user_abilities --min-attempts 5 --days 90
```

**Options:**
- `--min-attempts`: Minimum quiz attempts for ranking (default: 5)
- `--days`: Number of days of history (default: 90)
- `--user-id`: Compute for specific user only (optional)

**What it does:**
1. For each user, fetches quiz attempt history
2. Computes overall ability using ELO-style rating
3. Computes subject-specific abilities
4. Ranks all users and computes percentiles
5. Updates `UserAbilityProfile` and denormalized fields on Profile model

**Performance:** ~5 minutes for 10k users

**Schedule:** Daily or every 12 hours

---

### 3. compute_match_scores

Computes user-content match scores for personalized recommendations.

**Usage:**
```bash
python manage.py compute_match_scores --top-n 100
```

**Options:**
- `--top-n`: Number of top matches to store per user (default: 100)
- `--user-id`: Compute matches for specific user (optional)
- `--batch-size`: Users per batch (default: 50)

**What it does:**
1. For each user with ability profile:
   - Fetches candidate quizzes (filtered by preferences)
   - Computes match score based on:
     - Zone of Proximal Development (optimal difficulty gap)
     - Preference alignment (subject/tags/language match)
     - Recency penalty (avoid recently attempted)
   - Stores top N matches in `MatchScore` table

**Performance:** ~20-30 minutes for 10k users

**Schedule:** Every 6-12 hours

---

## API Endpoints

All endpoints require authentication.

### GET /api/intelligence/my-ability/

Returns user's ability profile with rankings.

**Response:**
```json
{
  "username": "john_doe",
  "overall_ability_score": 520.5,
  "ability_level": "Intermediate",
  "ability_by_subject": {
    "1": 480.0,
    "2": 550.0
  },
  "total_quizzes_attempted": 45,
  "total_correct_answers": 32,
  "recent_performance_trend": 5.2,
  "global_rank": 120,
  "percentile": 85.3,
  "last_computed_at": "2025-12-05T10:30:00Z"
}
```

---

### GET /api/intelligence/learning-path/

Returns optimized sequence of next quizzes.

**Query Params:**
- `limit` (default: 20, max: 50)

**Response:**
```json
{
  "path": [
    {
      "quiz_id": 42,
      "title": "Algebra Basics",
      "subject": "Mathematics",
      "difficulty_score": 530.0,
      "difficulty_level": "Medium",
      "match_score": 85.3,
      "why": "Perfect match for your level 🎯",
      "estimated_time_minutes": 12,
      "permalink": "teacher/math/2025-11-15/algebra-basics"
    },
    // ... more items
  ],
  "total_items": 20
}
```

---

### GET /api/intelligence/progress-insights/

Returns trend analysis, strengths, weaknesses, achievements.

**Response:**
```json
{
  "overall_trend": "Great progress!",
  "trend_direction": "Improving 📈",
  "performance_change": 8.5,
  "strengths": [
    {
      "subject": "Mathematics",
      "score": 580.0,
      "level": "Advanced"
    }
  ],
  "weaknesses": [
    {
      "subject": "Physics",
      "score": 420.0,
      "gap": 100.5
    }
  ],
  "recommended_focus_areas": [
    "Focus on Physics to close the gap",
    "Review recently difficult topics"
  ],
  "recent_achievements": [
    {
      "title": "Quiz Explorer",
      "description": "Completed 10+ quizzes",
      "icon": "🎯"
    }
  ],
  "next_milestones": [
    {
      "title": "Quiz Master",
      "target": 50,
      "current": 45,
      "description": "Complete 50 quizzes"
    }
  ]
}
```

---

### GET /api/intelligence/recommended-subjects/

Suggests new subjects to explore.

**Response:**
```json
{
  "recommended_subjects": [
    {
      "subject_id": 5,
      "subject_name": "Chemistry",
      "relevance_score": 80.0,
      "reason": "15 quizzes available to explore",
      "quiz_count": 15
    }
  ]
}
```

---

## Feed Integration

The intelligence app enhances the existing feed system with AI-powered recommendations.

### Enhanced Feed Flow

1. **Review Queue** (unchanged): Spaced-repetition items from MemoryStat
2. **Personalized (AI-enhanced)**:
   - First tries `MatchScore` lookups (fast, AI-optimized)
   - Falls back to classic subject/language/location logic if no AI data
3. **Explore** (unchanged): Newest content in user's subjects
4. **Challenge Mode** (new): Harder quizzes for users who want a challenge
5. **Confidence Builders** (new): Easier quizzes for quick wins

### Backward Compatibility

- If intelligence app is not installed → feed works normally
- If user has no ability profile → falls back to classic logic
- If MatchScore data is stale → regenerates or uses fallback

---

## Performance Optimization

### Database Indexes

```sql
-- UserAbilityProfile
CREATE INDEX idx_ability_score ON intelligence_userabilityprofie(overall_ability_score);
CREATE INDEX idx_global_rank ON intelligence_userabilityprofie(global_rank);

-- ContentDifficultyProfile
CREATE INDEX idx_difficulty_score ON intelligence_contentdifficultyprofile(computed_difficulty_score);
CREATE INDEX idx_content_lookup ON intelligence_contentdifficultyprofile(content_type_id, object_id);

-- MatchScore (critical for feed queries)
CREATE INDEX idx_user_match ON intelligence_matchscore(user_id, match_score DESC, computed_at);

-- Denormalized fields on existing models
CREATE INDEX idx_quiz_difficulty ON quizzes_quiz(computed_difficulty_score) WHERE computed_difficulty_score IS NOT NULL;
CREATE INDEX idx_profile_ability ON users_profile(overall_ability_score) WHERE overall_ability_score IS NOT NULL;
```

### Caching Strategy

- Redis cache for UserAbilityProfile (TTL: 12 hours)
- Redis cache for top 50 MatchScore per user (TTL: 6 hours)
- Django ORM `select_related` / `prefetch_related` for all FK lookups

### Query Patterns

Feed queries use:
```python
# Fast: index-only scan
MatchScore.objects.filter(user=user).order_by('-match_score')[:50]

# Denormalized: no JOINs needed
Quiz.objects.filter(computed_difficulty_score__gte=400, computed_difficulty_score__lte=600)
```

---

## Deployment Checklist

### Initial Setup

1. **Add app to INSTALLED_APPS** (✓ Already done)
2. **Run migrations:**
   ```bash
   python manage.py makemigrations intelligence
   python manage.py makemigrations quizzes
   python manage.py makemigrations users
   python manage.py migrate
   ```

3. **Create database indexes** (optional, for production):
   ```bash
   python manage.py dbshell < path/to/intelligence_indexes.sql
   ```

### First-Time Data Population

1. **Compute content difficulty:**
   ```bash
   python manage.py compute_content_difficulty --days 180
   ```

2. **Compute user abilities:**
   ```bash
   python manage.py compute_user_abilities --days 180
   ```

3. **Compute match scores:**
   ```bash
   python manage.py compute_match_scores --top-n 100
   ```

### Ongoing Maintenance (Cron Jobs)

Add to crontab or use Celery Beat:

```bash
# Daily at 2 AM: Recompute difficulty
0 2 * * * cd /path/to/project && python manage.py compute_content_difficulty

# Daily at 3 AM: Recompute user abilities
0 3 * * * cd /path/to/project && python manage.py compute_user_abilities

# Every 6 hours: Recompute match scores
0 */6 * * * cd /path/to/project && python manage.py compute_match_scores
```

---

## Monitoring

### Key Metrics to Track

1. **Coverage:**
   - % of users with UserAbilityProfile
   - % of quizzes with ContentDifficultyProfile
   - Avg MatchScore count per user

2. **Performance:**
   - Management command execution time
   - API endpoint response times (<20ms target)
   - Feed generation time (<50ms target)

3. **Quality:**
   - Difficulty score accuracy (compare to teacher-set difficulty)
   - User engagement with AI recommendations
   - Completion rates for recommended content

### Admin Queries

```python
# Check coverage
from intelligence.models import UserAbilityProfile, ContentDifficultyProfile, MatchScore
from django.contrib.auth import get_user_model

User = get_user_model()
total_users = User.objects.count()
users_with_ability = UserAbilityProfile.objects.count()
coverage_pct = (users_with_ability / total_users) * 100
print(f"Ability profile coverage: {coverage_pct:.1f}%")

# Check MatchScore freshness
from datetime import timedelta
from django.utils import timezone

stale_threshold = timezone.now() - timedelta(hours=24)
stale_match_scores = MatchScore.objects.filter(computed_at__lt=stale_threshold).count()
print(f"Stale match scores: {stale_match_scores}")
```

---

## Troubleshooting

### Issue: Users not getting AI recommendations

**Check:**
1. Does user have UserAbilityProfile? (`user.ability_profile`)
2. Does user have MatchScore entries? (`MatchScore.objects.filter(user=user).count()`)
3. Has user attempted enough quizzes? (min 5 for ability profiling)

**Fix:**
```bash
# Recompute for specific user
python manage.py compute_user_abilities --user-id 123
python manage.py compute_match_scores --user-id 123
```

---

### Issue: Management commands taking too long

**Optimize:**
1. Reduce `--days` parameter (analyze less history)
2. Increase `--batch-size` for compute_match_scores
3. Use `--content-type quiz` to skip questions
4. Run during low-traffic hours

**Scale:**
- Split by user cohorts (e.g., active users first)
- Use separate worker machines
- Consider Celery for distributed processing

---

### Issue: AI recommendations seem poor quality

**Debug:**
1. Check difficulty score distribution:
   ```python
   ContentDifficultyProfile.objects.aggregate(Avg('computed_difficulty_score'))
   ```

2. Check ability score distribution:
   ```python
   UserAbilityProfile.objects.aggregate(Avg('overall_ability_score'))
   ```

3. Check match score distribution:
   ```python
   MatchScore.objects.filter(user_id=123).aggregate(Avg('match_score'))
   ```

**Tune:**
- Adjust weights in `compute_match_score()` function (in `intelligence/utils.py`)
- Adjust ZPD optimal range (default: -50 to +50)
- Increase min_attempts threshold for more confident scores

---

## Future Enhancements

### Planned Features

1. **Collaborative Filtering**: Use user similarity for recommendations
2. **Topic Modeling**: Cluster content by semantic similarity
3. **Adaptive Quizzing**: Dynamically adjust question difficulty within quiz
4. **Learning Path Optimization**: Use reinforcement learning for sequencing
5. **Predictive Analytics**: Forecast user success on specific content

### Embedding Support

To enable semantic matching with embeddings:

1. Install sentence-transformers:
   ```bash
   pip install sentence-transformers
   ```

2. Run embedding generation:
   ```bash
   python manage.py generate_content_embeddings
   ```

3. Embeddings stored in `ContentDifficultyProfile.metadata['embedding']`
4. Cosine similarity computed in `compute_match_scores`

---

## Support

For questions or issues:
- Check logs: `tail -f logs/intelligence.log`
- Django admin: `/administration-zporta-repersentiivie/intelligence/`
- Code: `intelligence/` directory

---

**Last Updated:** December 5, 2025  
**Version:** 1.0.0  
**Maintainer:** Zporta Academy Development Team
