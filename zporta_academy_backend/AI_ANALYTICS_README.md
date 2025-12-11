# AI-Powered Learning Analytics & Recommendations

## Overview

This system analyzes user learning data locally using Python libraries (NumPy, Pandas) to **minimize API costs** and generate personalized recommendations. It saves detailed reports as JSON files for admin review.

## Features

### 1. **Local Data Analysis (Zero API Cost)**
- Collects comprehensive learning data from all app sources
- Analyzes patterns using Python libraries (NumPy, Pandas)
- No expensive LLM calls for data processing

### 2. **Intelligent Recommendations**
- Identifies weak areas needing practice
- Suggests related courses based on strong areas
- Generates actionable next steps
- Tracks study consistency and streaks

### 3. **Admin Reports**
- Saves detailed JSON reports for every analysis
- Stored in: `media/ai_analytics_reports/`
- Format: `user_{id}_{username}_{timestamp}.json`
- Includes full analysis + recommendations

### 4. **Personalized Script Generation**
- Injects user learning context into podcast scripts
- Mentions specific courses user is studying
- Addresses weak areas identified by AI
- Builds on strong areas for motivation

## How It Works

### Step 1: User Analysis
```python
from dailycast.ai_analyzer import analyze_user_and_generate_feedback

result = analyze_user_and_generate_feedback(user)
# Returns: analysis data, recommendations, report file path
```

### Step 2: Local Analytics (No API Calls)
- **Course Progress**: Calculate completion rates for each course
- **Quiz Performance**: Identify topics with <70% accuracy (weak areas)
- **Study Patterns**: Detect preferred study time, calculate streaks
- **Activity Tracking**: Count active days, analyze consistency
- **Performance Trends**: Find strong areas (>85% accuracy)

### Step 3: Generate Recommendations
```python
analyzer = UserLearningAnalyzer(user)
analysis = analyzer.collect_user_learning_data()  # Local processing
recommendations = analyzer.generate_recommendations()  # No API calls
report_path = analyzer.save_analysis_report()  # Save for admin
```

### Step 4: Save Report
JSON report includes:
```json
{
  "metadata": {
    "user_id": 1,
    "username": "alex",
    "report_generated_at": "2025-12-10T14:30:22",
    "analysis_version": "1.0"
  },
  "learning_data": {
    "total_courses": 5,
    "lessons_completed": 42,
    "quiz_accuracy": 78.5,
    "study_streak": 7,
    "weak_topics": [
      {"topic": "Grammar", "avg_score": 65.2, "attempts": 8}
    ],
    "strong_topics": [
      {"topic": "Vocabulary", "avg_score": 92.1, "attempts": 15}
    ],
    "course_progress": [...]
  },
  "recommendations": {
    "priority_actions": [...],
    "suggested_courses": [...],
    "next_steps": [...]
  }
}
```

## Usage in Admin

### 1. AI Analysis Button
1. Select a user in the podcast form
2. Click **"🔍 AI Analysis & Recommendations"**
3. View instant analysis results with:
   - Learning summary (courses, progress, streaks)
   - Weak areas to improve
   - Strong areas to build on
   - Actionable next steps

### 2. Personalized Script Generation
When generating podcast scripts, the system automatically:
- Loads user's learning context
- Mentions enrolled courses
- Addresses weak areas needing practice
- Builds on strong topics for motivation
- Suggests next steps based on AI analysis

Example script excerpt:
```
Hey Alex! I noticed you've been crushing it with Vocabulary (92% mastery!), 
but Grammar needs some practice at 65%. Let's focus on...

You're currently working through 3 courses, and you're so close to finishing 
"Business English" - only 4 lessons left! Let's tackle...
```

### 3. Admin Report Review
Access saved reports:
```bash
media/ai_analytics_reports/
├── user_1_alex_20251210_143022.json
├── user_1_alex_20251209_091530.json
└── user_2_maria_20251210_102045.json
```

## API Endpoints

### Analyze User
```
GET /api/admin/ajax/analyze-user/?user_id=1

Response:
{
  "success": true,
  "analysis": {...},
  "recommendations": {...},
  "report_path": "/path/to/report.json",
  "message": "Analysis complete - report saved for admin review"
}
```

### List Reports
```
GET /api/admin/ajax/ai-reports/
GET /api/admin/ajax/ai-reports/?user_id=1

Response:
{
  "success": true,
  "reports": [
    {
      "filename": "user_1_alex_20251210_143022.json",
      "filepath": "/full/path/to/report.json",
      "user_id": 1,
      "username": "alex",
      "generated_at": "2025-12-10T14:30:22",
      "file_size": 12345
    }
  ],
  "count": 1
}
```

## Cost Savings

### Traditional Approach (Expensive)
1. Load user data
2. Call LLM API to analyze ($$)
3. Call LLM API for recommendations ($$)
4. Parse response
**Total: 2-3 API calls per analysis (~$0.10-0.50)**

### Our Approach (Efficient)
1. Load user data
2. **Analyze locally** with Python (FREE)
3. **Generate recommendations** with algorithms (FREE)
4. Save report
5. Only use LLM for final script generation (1 call)
**Total: 1 API call (~$0.05-0.15)**

**Savings: 60-80% on analytics processing**

## Data Sources

The analyzer collects from:
- ✅ **Enrollment**: Courses enrolled, completion rates
- ✅ **Lessons**: Completed lessons, progress per course
- ✅ **Quizzes**: Scores, accuracy by topic
- ✅ **Analytics**: Activity events, study patterns
- ✅ **Intelligence**: User ability profiles (if available)
- ✅ **Gamification**: Points, badges, achievements

## Dependencies

### Required
- Django (included)
- Python 3.8+ (included)

### Optional (for advanced analytics)
```bash
pip install numpy pandas
```

If not installed, basic analytics still work without advanced features.

## Configuration

No configuration needed! The system automatically:
- Creates report directory on first use
- Uses existing database models
- Falls back gracefully if optional dependencies missing

## Example Use Cases

### 1. Identify Struggling Students
```python
# Admin can review all reports to find users needing help
reports = get_all_user_reports()
struggling = [r for r in reports if r['analysis']['quiz_accuracy'] < 60]
```

### 2. Send Personalized Encouragement
```python
analyzer = UserLearningAnalyzer(user)
analysis = analyzer.collect_user_learning_data()

if analysis['study_streak'] > 7:
    send_email(user, "Amazing! 7-day streak!")
```

### 3. Course Recommendations
```python
analyzer = UserLearningAnalyzer(user)
recs = analyzer.generate_recommendations()

# Suggest courses based on strong areas
for course in recs['suggested_courses']:
    notify_user(user, f"Try {course['course_title']}!")
```

## Future Enhancements

- [ ] Pandas DataFrames for trend analysis
- [ ] NumPy for statistical insights
- [ ] ML models for predictive analytics
- [ ] Automated weekly reports
- [ ] Email notifications for recommendations
- [ ] Dashboard for admin to view all users

## Troubleshooting

### "No activity found"
- User hasn't completed any lessons/quizzes yet
- Check that ActivityEvent tracking is enabled

### "Report not saved"
- Check media directory permissions
- Verify `MEDIA_ROOT` is configured in settings

### "Analysis incomplete"
- Some app models may not be available
- System degrades gracefully and uses available data

## License

MIT License - Part of Zporta Academy
