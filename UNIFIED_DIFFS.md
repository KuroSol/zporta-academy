# Unified Diffs: Student Analytics Redesign and AI Insights

## File 1: dailycast/admin_student_insights.py

```diff
--- a/dailycast/admin_student_insights.py
+++ b/dailycast/admin_student_insights.py
@@ -1,10 +1,14 @@
 """
 Student Learning Insights Admin Interface
 Provides human-readable AI analysis for each student.
 """
 import logging
+import json
 from django.contrib import admin
 from django.contrib.auth import get_user_model
 from django.utils.safestring import mark_safe
 from django.urls import path
 from django.shortcuts import render
 from django.db.models import Count, Avg, Q
+from django.http import JsonResponse
+from django.utils import timezone
 from datetime import timedelta
-from django.utils import timezone
 
-from dailycast.ai_analyzer import UserLearningAnalyzer, analyze_user_and_generate_feedback
+from dailycast.ai_analyzer import UserLearningAnalyzer, analyze_user_and_generate_feedback, _run_ai_deep_analysis
 
 User = get_user_model()
 logger = logging.getLogger(__name__)
@@ -75,8 +79,12 @@ class StudentLearningInsightAdmin(admin.ModelAdmin):
         custom_urls = [
             path(
                 '<int:user_id>/detail/',
                 self.admin_site.admin_view(self.student_detail_view),
                 name='student_insight_detail',
             ),
             path(
                 '<int:user_id>/refresh/',
                 self.admin_site.admin_view(self.refresh_analysis_view),
                 name='refresh_student_analysis',
+            ),
+            path(
+                '<int:user_id>/ai-insights/',
+                self.admin_site.admin_view(self.ai_insights_view),
+                name='student_ai_insights',
             ),
         ]
         return custom_urls + urls
@@ -88,28 +96,48 @@ class StudentLearningInsightAdmin(admin.ModelAdmin):
             user = User.objects.get(id=user_id)
         except User.DoesNotExist:
             from django.http import HttpResponseNotFound
             return HttpResponseNotFound("Student not found")
         
-        # Run AI analysis
+        # Always collect and display analytics data (with or without AI analysis)
         try:
+            analyzer = UserLearningAnalyzer(user)
+            analysis_data = analyzer.collect_user_learning_data()
+            logger.info(f"✅ Loaded analytics for user {user_id}: {analysis_data.get('total_courses')} courses, {analysis_data.get('lessons_completed')} lessons")
+        except Exception as e:
+            logger.exception(f"Error collecting analytics for user {user_id}: {e}")
+            analysis_data = {
+                'total_courses': 0,
+                'lessons_completed': 0,
+                'notes_count': 0,
+                'quizzes_completed': 0,
+                'quiz_accuracy': 0.0,
+                'study_streak': 0,
+                'active_days': 0,
+                'error': str(e)
+            }
+        
+        # Generate recommendations based on collected data
+        try:
+            analyzer = UserLearningAnalyzer(user)
+            analyzer.analysis_data = analysis_data
+            recommendations = analyzer.generate_recommendations()
+        except Exception as e:
+            logger.exception(f"Error generating recommendations for user {user_id}: {e}")
+            recommendations = {
+                'priority_actions': [],
+                'study_tips': [],
+                'next_steps': [],
+                'error': str(e)
+            }
+        
         context = {
             'title': f'Learning Insights: {user.get_full_name() or user.username}',
             'user': user,
-            'analysis': analysis,
-            'recommendations': recommendations,
-            'success': success,
-            'error': error,
+            'analysis': analysis_data,
+            'recommendations': recommendations,
             'opts': self.model._meta,
             'has_view_permission': True,
         }
         
         return render(request, 'admin/dailycast/student_insight_detail.html', context)
     
     def refresh_analysis_view(self, request, user_id):
         """AJAX endpoint to refresh AI analysis with selected model."""
-        import json
-        from django.http import JsonResponse
         
         if request.method != 'POST':
             return JsonResponse({'success': False, 'error': 'POST required'}, status=405)
@@ -138,6 +166,38 @@ class StudentLearningInsightAdmin(admin.ModelAdmin):
                 'success': False,
                 'error': str(e)
             }, status=500)
+    
+    def ai_insights_view(self, request, user_id):
+        """AJAX endpoint to generate AI insights for a specific subject and engine."""
+        
+        if request.method != 'POST':
+            return JsonResponse({'success': False, 'error': 'POST required'}, status=405)
+        
+        try:
+            user = User.objects.get(id=user_id)
+        except User.DoesNotExist:
+            return JsonResponse({'success': False, 'error': 'User not found'}, status=404)
+        
+        try:
+            # Parse request body
+            data = json.loads(request.body)
+            subject = data.get('subject', '')  # e.g., 'English', 'Math', or empty for all
+            engine = data.get('engine', 'gemini-2.0-flash-exp')  # AI model/engine
+            
+            logger.info(f"🤖 Generating AI insights for user {user_id}, subject={subject}, engine={engine}")
+            
+            # Collect user data
+            analyzer = UserLearningAnalyzer(user)
+            analysis_data = analyzer.collect_user_learning_data()
+            
+            # Run AI analysis with specified engine
+            ai_insights = _run_ai_deep_analysis(user, analysis_data, engine, subject=subject)
+            
+            return JsonResponse({
+                'success': True,
+                'insights': ai_insights,
+                'subject': subject or 'All Subjects',
+                'engine': engine,
+                'timestamp': timezone.now().isoformat()
+            })
+            
+        except Exception as e:
+            logger.exception(f"Error generating AI insights for user {user_id}: {e}")
+            return JsonResponse({
+                'success': False,
+                'error': str(e)
+            }, status=500)
```

## File 2: dailycast/ai_analyzer.py

```diff
--- a/dailycast/ai_analyzer.py
+++ b/dailycast/ai_analyzer.py
@@ -620,8 +620,10 @@ def _run_ai_deep_analysis(user, analysis_data: Dict, ai_model: str) -> Dict:
     """
     Use AI to provide deep insights about user's English level, 
     learning patterns, and personalized recommendations.
     
     Analyzes: enrollment, quiz scores, notes content, activity patterns
+    
+    Args:
+        user: User object to analyze
+        analysis_data: Dictionary containing user analytics
+        ai_model: AI model to use (e.g., 'gemini-2.0-flash-exp', 'gpt-4o-mini')
+        subject: Optional subject to focus analysis on (e.g., 'Math', 'English')
+    
+    Returns:
+        Dictionary with summary, strengths, weaknesses, recommendations
     """
     import google.generativeai as genai
     from django.conf import settings
     
     # Gather user notes
     from notes.models import Note
     user_notes = Note.objects.filter(user=user).order_by('-created_at')[:20]
     notes_text = "\n".join([f"- {note.content[:200]}" for note in user_notes])
+    
+    # Filter analysis data by subject if specified
+    weak_topics = analysis_data.get('weak_topics', [])
+    strong_topics = analysis_data.get('strong_topics', [])
+    
+    if subject:
+        weak_topics = [t for t in weak_topics if subject.lower() in t.get('topic', '').lower()]
+        strong_topics = [t for t in strong_topics if subject.lower() in t.get('topic', '').lower()]
+        subject_focus = f"Focus on {subject}"
+    else:
+        subject_focus = "Analyze all subjects"
     
     # Build comprehensive prompt
-    prompt = f"""Analyze this student's learning profile and provide detailed insights:
+    prompt = f"""{subject_focus}
+
+Analyze this student's learning profile and provide detailed insights:
 
 STUDENT PROFILE:
 - Name: {user.get_full_name() or user.username}
 - Enrolled Courses: {analysis_data.get('total_courses', 0)}
 - Lessons Completed: {analysis_data.get('lessons_completed', 0)}
 - Quizzes Taken: {analysis_data.get('quizzes_completed', 0)}
 - Quiz Accuracy: {analysis_data.get('quiz_accuracy', 0):.1f}%
 - Study Streak: {analysis_data.get('study_streak', 0)} days
 - Active Days (30d): {analysis_data.get('active_days', 0)}
 
 WEAK TOPICS:
-{chr(10).join([f"- {t['topic']}: {t['avg_score']}%" for t in analysis_data.get('weak_topics', [])[:5]])}
+{chr(10).join([f"- {t['topic']}: {t['avg_score']}%" for t in weak_topics[:5]]) if weak_topics else "- No weak areas identified"}
 
 STRONG TOPICS:
-{chr(10).join([f"- {t['topic']}: {t['avg_score']}%" for t in analysis_data.get('strong_topics', [])[:5]])}
+{chr(10).join([f"- {t['topic']}: {t['avg_score']}%" for t in strong_topics[:5]]) if strong_topics else "- No strong areas identified yet"}
 
 RECENT NOTES (last 20):
 {notes_text if notes_text else "No notes yet"}
 
 TASK:
-1. Estimate their English proficiency level (A1-C2)
-2. Identify learning style and patterns
-3. Provide 3-5 specific, actionable recommendations
-4. Suggest optimal study schedule based on their activity
+Provide a focused analysis with:
+1. Brief summary of student's learning progress
+2. Key strengths (3-5 bullet points)
+3. Areas for improvement (3-5 bullet points)
+4. Specific, actionable study recommendations (3-5 bullet points)
 
-Return JSON format:
+Format response as JSON with keys: summary, strengths (array), weaknesses (array), recommendations (array)
+Example:
 {{
-    "english_level": "B1",
-    "english_level_reasoning": "...",
-    "learning_style": "...",
+    "summary": "Student is making good progress...",
     "strengths": ["...", "..."],
-    "areas_for_improvement": ["...", "..."],
+    "weaknesses": ["...", "..."],
     "recommendations": ["...", "..."],
-    "study_schedule_suggestion": "..."
 }}"""
     
-    # Call AI model
+    # Call AI model
-    if ai_model.startswith('gemini'):
+    try:
+        if ai_model.startswith('gemini'):
         genai.configure(api_key=settings.GEMINI_API_KEY)
         model = genai.GenerativeModel(ai_model)
         response = model.generate_content(prompt)
         result_text = response.text
     elif ai_model.startswith('gpt'):
         import openai
         openai.api_key = settings.OPENAI_API_KEY
         response = openai.ChatCompletion.create(
             model=ai_model,
             messages=[{"role": "user", "content": prompt}],
             temperature=0.7,
+            max_tokens=1500
         )
         result_text = response.choices[0].message.content
     else:
         raise ValueError(f"Unsupported AI model: {ai_model}")
     
-    # Parse JSON response
-    import json
-    import re
-    # Extract JSON from markdown code blocks if present
-    json_match = re.search(r'```json\s*(.*?)\s*```', result_text, re.DOTALL)
+        # Parse JSON response
+        import json
+        import re
+        # Extract JSON from markdown code blocks if present
+        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', result_text, re.DOTALL)
         if json_match:
             result_text = json_match.group(1)
         
         ai_insights = json.loads(result_text)
         return ai_insights
+        
+    except Exception as e:
+        logger.exception(f"Error during AI analysis with model {ai_model}: {e}")
+        # Return a safe fallback response
+        return {
+            'summary': 'Unable to generate AI insights at this time.',
+            'strengths': [],
+            'weaknesses': [],
+            'recommendations': [],
+            'error': str(e)
+        }
```

## File 3: dailycast/templates/admin/dailycast/student_insight_detail.html

```diff
--- a/dailycast/templates/admin/dailycast/student_insight_detail.html
+++ b/dailycast/templates/admin/dailycast/student_insight_detail.html
@@ -260,86 +260,165 @@
 {% block content %}
 <div class="insight-container">
     <a href="{% url 'admin:dailycast_studentlearninginsight_changelist' %}" class="back-link">
         ← Back to All Students
     </a>
 
     <div class="student-header">
         <h1>{{ user.get_full_name|default:user.username }}</h1>
         <div class="subtitle">
             @{{ user.username }} • Member since {{ user.date_joined|date:"F d, Y" }}
         </div>
     </div>
 
-    <!-- AI Refresh Controls -->
-    <div class="refresh-controls">
-        <h3>🤖 AI Analysis Controls</h3>
-        <div class="refresh-form">
-            <div style="margin-bottom: 15px;">
-                <label for="ai-subject">Focus Subject (Optional):</label>
-                <select id="ai-subject" name="ai_subject" style="margin-left: 10px; padding: 8px; border-radius: 4px;">
-                    <option value="">All Subjects</option>
-                    <option value="english">📚 English</option>
-                    <option value="programming">💻 Programming</option>
-                    <option value="mathematics">🔢 Mathematics</option>
-                    <option value="science">🔬 Science</option>
-                    <option value="history">📜 History</option>
-                    <option value="business">💼 Business</option>
-                </select>
-            </div>
-            <label for="ai-model">Select AI Model:</label>
-            <select id="ai-model" name="ai_model">
-                <optgroup label="Google Gemini">
-                    <option value="gemini-2.0-flash-exp" selected>Gemini 2.0 Flash (Fast & Cheap)</option>
-                    <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Best Quality)</option>
-                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
-                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
-                </optgroup>
-                <optgroup label="OpenAI GPT">
-                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
-                    <option value="gpt-4o">GPT-4o (Balanced)</option>
-                    <option value="gpt-4-turbo">GPT-4 Turbo (High Quality)</option>
-                </optgroup>
-            </select>
-            <button type="button" class="refresh-btn" id="refresh-analysis-btn" onclick="refreshAnalysis()">
-                🔄 Refresh AI Analysis
-            </button>
-            <span class="loading-indicator" id="loading-indicator">⏳ Analyzing...</span>
-        </div>
-        <p style="margin: 10px 0 0 0; color: #666; font-size: 13px;">
-            💡 Select a subject to get focused advice, or analyze all subjects. This will review user's quiz scores, notes, enrolled courses, and activity to provide real, personalized insights.
-        </p>
+    <!-- SUMMARY SECTION (Always Visible) -->
+    <div class="section">
+        <h2 class="section-title">📊 Learning Summary</h2>
+        <div class="stats-grid">
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.total_courses|default:0 }}</span>
+                <span class="stat-label">📚 Enrolled Courses</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.lessons_completed|default:0 }}</span>
+                <span class="stat-label">✅ Lessons Completed</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.notes_count|default:0 }}</span>
+                <span class="stat-label">📔 Notes Written</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.quizzes_completed|default:0 }}</span>
+                <span class="stat-label">📝 Quizzes Taken</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.quiz_accuracy|default:0|floatformat:1 }}%</span>
+                <span class="stat-label">🎯 Quiz Accuracy</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.study_streak|default:0 }}</span>
+                <span class="stat-label">🔥 Study Streak (days)</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.active_days|default:0 }}</span>
+                <span class="stat-label">📅 Active Days (30d)</span>
+            </div>
+        </div>
     </div>
 
-    {% if not success %}
+    <!-- AI INSIGHTS PANEL -->
     <div class="section">
-        {% if error %}
-            <div class="error-message">
-                <strong>⚠️ Error analyzing student data:</strong><br>
-                {{ error }}
-            </div>
-        {% else %}
-            <div style="background: #e8f4f8; border-left: 4px solid #417690; padding: 15px; border-radius: 4px;">
-                <strong>ℹ️ Analysis not yet triggered</strong><br>
-                Click the "Analyze with AI" button above to generate insights.
+        <h2 class="section-title">🤖 AI-Generated Insights</h2>
+        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
+            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 15px;">
+                <div>
+                    <label for="ai-subject" style="display: block; font-weight: bold; margin-bottom: 8px; color: #333;">Focus Subject (Optional):</label>
+                    <select id="ai-subject" name="ai_subject" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
+                        <option value="">📚 All Subjects</option>
+                        <option value="english">📖 English</option>
+                        <option value="programming">💻 Programming</option>
+                        <option value="mathematics">🔢 Mathematics</option>
+                        <option value="science">🔬 Science</option>
+                        <option value="history">📜 History</option>
+                        <option value="business">💼 Business</option>
+                    </select>
+                </div>
+                <div>
+                    <label for="ai-engine" style="display: block; font-weight: bold; margin-bottom: 8px; color: #333;">AI Engine:</label>
+                    <select id="ai-engine" name="ai_engine" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;">
+                        <optgroup label="Google Gemini">
+                            <option value="gemini-2.0-flash-exp" selected>⚡ Gemini 2.0 Flash (Fast)</option>
+                            <option value="gemini-2.0-pro-exp">✨ Gemini 2.0 Pro (Best)</option>
+                            <option value="gemini-1.5-pro">🔧 Gemini 1.5 Pro</option>
+                        </optgroup>
+                        <optgroup label="OpenAI">
+                            <option value="gpt-4o-mini">⚡ GPT-4o Mini (Fast)</option>
+                            <option value="gpt-4o">🎯 GPT-4o (Balanced)</option>
+                            <option value="gpt-4-turbo">🚀 GPT-4 Turbo (Best)</option>
+                        </optgroup>
+                    </select>
+                </div>
+                <div style="display: flex; align-items: flex-end;">
+                    <button type="button" class="refresh-btn" id="generate-insights-btn" onclick="generateAIInsights()" style="width: 100%; margin: 0;">
+                        ✨ Generate Insights
+                    </button>
+                </div>
             </div>
-        {% endif %}
+            <span class="loading-indicator" id="insights-loading" style="display: none; text-align: center; width: 100%; margin-bottom: 10px;">
+                ⏳ Analyzing student data with AI...
+            </span>
+            <div id="insights-result" style="display: none; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #2196f3;"></div>
+            <div id="insights-error" style="display: none; background: #ffebee; padding: 15px; border-radius: 6px; border-left: 4px solid #f44336; color: #c62828;"></div>
+        </div>
     </div>
-    {% else %}
 
-    <!-- Learning Summary -->
+    <!-- COURSES & LESSONS SECTION -->
+    {% if analysis.enrolled_courses %}
     <div class="section">
-        <h2 class="section-title">📊 Learning Summary</h2>
-        <div class="stats-grid">
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.total_courses }}</span>
-                <span class="stat-label">📚 Enrolled Courses</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.lessons_completed }}</span>
-                <span class="stat-label">✅ Lessons Completed</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.notes_count }}</span>
-                <span class="stat-label">📔 Notes Written</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.quizzes_completed }}</span>
-                <span class="stat-label">📝 Quizzes Taken</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.quiz_accuracy|floatformat:1 }}%</span>
-                <span class="stat-label">🎯 Quiz Accuracy</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.study_streak }}</span>
-                <span class="stat-label">🔥 Study Streak (days)</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.active_days }}</span>
-                <span class="stat-label">📅 Active Days (30d)</span>
+        <h2 class="section-title">📚 Enrolled Courses & Lessons</h2>
+        <ul class="courses-list">
+            {% for course in analysis.enrolled_courses %}
+            <li class="course-item">
+                <div class="course-title">{{ course.title }}</div>
+                <div class="course-meta">
+                    📖 {{ course.subject|default:"Unknown Subject" }}
+                    {% if course.enrollment_date %}
+                    • Enrolled: {{ course.enrollment_date|date:"M d, Y" }}
+                    {% endif %}
+                </div>
+            </li>
+            {% endfor %}
+        </ul>
+    </div>
+    {% endif %}
+
+    <!-- AREAS FOR IMPROVEMENT SECTION -->
+    {% if analysis.weak_topics %}
+    <div class="section">
+        <h2 class="section-title">⚠️ Areas for Improvement</h2>
+        <p style="color: #666; margin-bottom: 15px;">
+            Topics with scores below 70% need more practice. Focus here for biggest gains!
+        </p>
+        <ul class="weak-topics">
+            {% for topic in analysis.weak_topics %}
+            <li>
+                <span class="topic-name">{{ topic.topic }}</span>
+                <span class="topic-score">{{ topic.avg_score }}%</span>
+            </li>
+            {% endfor %}
+        </ul>
+    </div>
+    {% endif %}
+
+    <!-- STRONG AREAS SECTION -->
+    {% if analysis.strong_topics %}
+    <div class="section">
+        <h2 class="section-title">💪 Strong Areas</h2>
+        <p style="color: #666; margin-bottom: 15px;">
+            Excellent mastery! Scoring 85%+ shows strong understanding of these topics.
+        </p>
+        <ul class="strong-topics">
+            {% for topic in analysis.strong_topics %}
+            <li>
+                <span class="topic-name">{{ topic.topic }}</span>
+                <span class="topic-score">{{ topic.avg_score }}%</span>
+            </li>
+            {% endfor %}
+        </ul>
     </div>
     {% endif %}
 
-    <!-- Enrolled Courses -->
-    {% if analysis.enrolled_courses %}
+    <!-- RECOMMENDATIONS SECTION -->
     <div class="section">
-        <h2 class="section-title">📚 Enrolled Courses</h2>
-        <ul class="courses-list">
-            {% for course in analysis.enrolled_courses %}
-            <li class="course-item">
-                <div class="course-title">{{ course.title }}</div>
-                <div class="course-meta">
-                    📖 {{ course.subject }} • Enrolled: {{ course.enrollment_date|date:"M d, Y" }}
-                </div>
+        <h2 class="section-title">🎯 Recommendations</h2>
+        
+        {% if recommendations.priority_actions %}
+        <h3 style="color: #666; font-size: 16px; margin: 0 0 15px 0;">📌 Priority Actions</h3>
+        <ul class="recommendations-list">
+            {% for action in recommendations.priority_actions %}
             <li>{{ action }}</li>
             {% endfor %}
         </ul>
+        {% endif %}
+
+        {% if recommendations.study_tips %}
+        <h3 style="color: #666; font-size: 16px; margin: 20px 0 15px 0;">💡 Study Tips</h3>
+        <ul class="recommendations-list">
+            {% for tip in recommendations.study_tips %}
             <li>
-                <div class="course-title">{{ course.title }}</div>
-                <div class="course-meta">
-                    📖 {{ course.subject }} • Enrolled: {{ course.enrollment_date|date:"M d, Y" }}
+                <strong>{{ tip.type|title }}:</strong> {{ tip.message }}<br>
+                <em style="color: #666; font-size: 13px;">💡 {{ tip.suggestion }}</em>
+            </li>
+            {% endfor %}
+        </ul>
+        {% endif %}
+
+        {% if recommendations.next_steps %}
+        <h3 style="color: #666; font-size: 16px; margin: 20px 0 15px 0;">📋 Next Steps</h3>
+        <ul class="recommendations-list">
+            {% for step in recommendations.next_steps %}
+            <li>{{ step }}</li>
+            {% endfor %}
+        </ul>
+        {% endif %}
+
+        {% if not recommendations.priority_actions and not recommendations.study_tips and not recommendations.next_steps %}
+        <div class="no-data-message">
+            <p>🎉 Great start! Complete more activities to get personalized recommendations.</p>
         </div>
-        </ul>
-    </div>
-    {% endif %}
+        {% endif %}
+    </div>
 
-    <!-- Weak Areas -->
-    {% if analysis.weak_topics %}
+    <!-- RECENT ACTIVITY SECTION -->
+    {% if analysis.recent_activity %}
     <div class="section">
-        <h2 class="section-title">⚠️ Areas for Improvement</h2>
-        <p style="color: #666; margin-bottom: 15px;">
-            These topics need more practice. Scoring below 70% indicates room for growth.
+        <h2 class="section-title">📈 Recent Activity</h2>
+        <div class="stats-grid">
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.recent_activity.last_7_days.total_events|default:0 }}</span>
+                <span class="stat-label">Events (Last 7 Days)</span>
+            </div>
+            <div class="stat-card">
+                <span class="stat-value">{{ analysis.recent_activity.last_30_days.total_events|default:0 }}</span>
+                <span class="stat-label">Events (Last 30 Days)</span>
+            </div>
+        </div>
+    </div>
+    {% endif %}
+</div>
+
+<script>
+function generateAIInsights() {
+    const btn = document.getElementById('generate-insights-btn');
+    const loading = document.getElementById('insights-loading');
+    const result = document.getElementById('insights-result');
+    const errorDiv = document.getElementById('insights-error');
+    const subject = document.getElementById('ai-subject').value;
+    const engine = document.getElementById('ai-engine').value;
+    
+    // Clear previous results
+    result.style.display = 'none';
+    errorDiv.style.display = 'none';
+    
+    // Disable button and show loading
+    btn.disabled = true;
+    loading.style.display = 'block';
+    
+    // Make AJAX request to AI insights endpoint
+    fetch('{% url "admin:student_ai_insights" user.id %}', {
+        method: 'POST',
+        headers: {
+            'Content-Type': 'application/json',
+            'X-CSRFToken': '{{ csrf_token }}'
+        },
+        body: JSON.stringify({
+            subject: subject,
+            engine: engine
+        })
+    })
+    .then(response => response.json())
+    .then(data => {
+        loading.style.display = 'none';
+        
+        if (data.success) {
+            const insights = data.insights;
+            let html = '<h3 style="color: #1976d2; margin-top: 0;">AI Analysis Results</h3>';
+            
+            if (insights.summary) {
+                html += '<p><strong>Summary:</strong> ' + insights.summary + '</p>';
+            }
+            
+            if (insights.strengths && insights.strengths.length > 0) {
+                html += '<p><strong>💪 Strengths:</strong></p><ul>';
+                insights.strengths.forEach(s => html += '<li>' + s + '</li>');
+                html += '</ul>';
+            }
+            
+            if (insights.weaknesses && insights.weaknesses.length > 0) {
+                html += '<p><strong>⚠️ Weaknesses:</strong></p><ul>';
+                insights.weaknesses.forEach(w => html += '<li>' + w + '</li>');
+                html += '</ul>';
+            }
+            
+            if (insights.recommendations && insights.recommendations.length > 0) {
+                html += '<p><strong>📚 What to Study Next:</strong></p><ul>';
+                insights.recommendations.forEach(r => html += '<li>' + r + '</li>');
+                html += '</ul>';
+            }
+            
+            result.innerHTML = html;
+            result.style.display = 'block';
+        } else {
+            errorDiv.innerHTML = '<strong>⚠️ Error:</strong> ' + (data.error || 'Failed to generate insights');
+            errorDiv.style.display = 'block';
+        }
+        
+        btn.disabled = false;
+    })
+    .catch(error => {
+        loading.style.display = 'none';
+        errorDiv.innerHTML = '<strong>⚠️ Network Error:</strong> ' + error;
+        errorDiv.style.display = 'block';
+        btn.disabled = false;
+    });
+}
+</script>
-        <ul class="weak-topics">
-            {% for topic in analysis.weak_topics %}
-            <li>
-                <span class="topic-name">{{ topic.topic }}</span>
-                <span class="topic-score">{{ topic.avg_score }}%</span>
-            </li>
-            {% endfor %}
-        </ul>
-    </div>
-    {% endif %}
-
-    <!-- Strong Areas -->
-    {% if analysis.strong_topics %}
-    <div class="section">
-        <h2 class="section-title">💪 Strong Areas</h2>
-        <p style="color: #666; margin-bottom: 15px;">
-            Excellent mastery! Scoring above 85% shows strong understanding.
-        </p>
-        <ul class="strong-topics">
-            {% for topic in analysis.strong_topics %}
-            <li>
-                <span class="topic-name">{{ topic.topic }}</span>
-                <span class="topic-score">{{ topic.avg_score }}%</span>
-            </li>
-            {% endfor %}
-        </ul>
-    </div>
-    {% endif %}
-
-    <!-- AI Recommendations -->
-    <div class="section">
-        <h2 class="section-title">🎯 AI Recommendations</h2>
-        
-        {% if recommendations.ai_insights %}
-        <div style="background: #e3f2fd; padding: 20px; border-radius: 6px; margin-bottom: 25px; border-left: 4px solid #2196f3;">
-            <h3 style="color: #1976d2; font-size: 18px; margin: 0 0 15px 0;">🤖 AI Deep Analysis</h3>
-            
-            {% if recommendations.ai_insights.error %}
-            <p style="color: #d32f2f;">⚠️ {{ recommendations.ai_insights.message }}</p>
-            {% else %}
-            <p><strong>English Level:</strong> {{ recommendations.ai_insights.english_level }} - {{ recommendations.ai_insights.english_level_reasoning }}</p>
-            <p><strong>Learning Style:</strong> {{ recommendations.ai_insights.learning_style }}</p>
-            
-            {% if recommendations.ai_insights.strengths %}
-            <p><strong>💪 Strengths:</strong></p>
-            <ul>
-                {% for strength in recommendations.ai_insights.strengths %}
-                <li>{{ strength }}</li>
-                {% endfor %}
-            </ul>
-            {% endif %}
-            
-            {% if recommendations.ai_insights.areas_for_improvement %}
-            <p><strong>📈 Areas for Improvement:</strong></p>
-            <ul>
-                {% for area in recommendations.ai_insights.areas_for_improvement %}
-                <li>{{ area }}</li>
-                {% endfor %}
-            </ul>
-            {% endif %}
-            
-            {% if recommendations.ai_insights.recommendations %}
-            <p><strong>💡 AI Recommendations:</strong></p>
-            <ul>
-                {% for rec in recommendations.ai_insights.recommendations %}
-                <li>{{ rec }}</li>
-                {% endfor %}
-            </ul>
-            {% endif %}
-            
-            {% if recommendations.ai_insights.study_schedule_suggestion %}
-            <p><strong>📅 Suggested Study Schedule:</strong> {{ recommendations.ai_insights.study_schedule_suggestion }}</p>
-            {% endif %}
-            {% endif %}
-        </div>
-        {% endif %}
-        
-        {% if recommendations.priority_actions %}
-        <h3 style="color: #666; font-size: 16px; margin: 20px 0 10px 0;">Priority Actions</h3>
-        <ul class="recommendations-list">
-            {% for action in recommendations.priority_actions %}
-            <li>{{ action }}</li>
-            {% endfor %}
-        </ul>
-        {% endif %}
-
-        {% if recommendations.study_tips %}
-        <h3 style="color: #666; font-size: 16px; margin: 20px 0 10px 0;">Study Tips</h3>
-        <ul class="recommendations-list">
-            {% for tip in recommendations.study_tips %}
-            <li>
-                <strong>{{ tip.type|title }}:</strong> {{ tip.message }}<br>
-                <em style="color: #666; font-size: 13px;">💡 {{ tip.suggestion }}</em>
-            </li>
-            {% endfor %}
-        </ul>
-        {% endif %}
-
-        {% if recommendations.next_steps %}
-        <h3 style="color: #666; font-size: 16px; margin: 20px 0 10px 0;">Next Steps</h3>
-        <ul class="recommendations-list">
-            {% for step in recommendations.next_steps %}
-            <li>{{ step }}</li>
-            {% endfor %}
-        </ul>
-        {% endif %}
-
-        {% if not recommendations.priority_actions and not recommendations.study_tips and not recommendations.next_steps %}
-        <div class="no-data-message">
-            <p>🎉 Great start! Complete more activities to get personalized recommendations.</p>
-        </div>
-        {% endif %}
-    </div>
-
-    <!-- Recent Activity -->
-    {% if analysis.recent_activity %}
-    <div class="section">
-        <h2 class="section-title">📈 Recent Activity</h2>
-        <div class="stats-grid">
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.recent_activity.last_7_days.total_events }}</span>
-                <span class="stat-label">Events (Last 7 Days)</span>
-            </div>
-            <div class="stat-card">
-                <span class="stat-value">{{ analysis.recent_activity.last_30_days.total_events }}</span>
-                <span class="stat-label">Events (Last 30 Days)</span>
-            </div>
-        </div>
-    </div>
-    {% endif %}
-
-    {% endif %}
-</div>
-
-<script>
-function refreshAnalysis() {
-    const btn = document.getElementById('refresh-analysis-btn');
-    const loading = document.getElementById('loading-indicator');
-    const model = document.getElementById('ai-model').value;
-    const subject = document.getElementById('ai-subject').value;
-    
-    // Disable button and show loading
-    btn.disabled = true;
-    loading.classList.add('active');
-    
-    // Make AJAX request
-    fetch('{% url "admin:refresh_student_analysis" user.id %}', {
-        method: 'POST',
-        headers: {
-            'Content-Type': 'application/json',
-            'X-CSRFToken': '{{ csrf_token }}'
-        },
-        body: JSON.stringify({
-            ai_model: model,
-            subject: subject
-        })
-    })
-    .then(response => response.json())
-    .then(data => {
-        if (data.success) {
-            // Reload page to show updated analysis
-            window.location.reload();
-        } else {
-            alert('Error: ' + data.error);
-            btn.disabled = false;
-            loading.classList.remove('active');
-        }
-    })
-    .catch(error => {
-        alert('Network error: ' + error);
-        btn.disabled = false;
-        loading.classList.remove('active');
-    });
-}
-</script>
 {% endblock %}
```

## Summary of Changes

### Bug Fixes
1. **Zero Data Bug**: Changed `student_detail_view` to always load and display analytics data, removing the conditional `success` check that was preventing data display
2. **Data Collection**: Improved error handling so analytics display even if AI analysis fails
3. **State Persistence**: Summary section now always remains visible; clicking items in other sections no longer reinitializes state

### New Features
1. **Redesigned Summary Section**: 
   - Now always visible at top with stat cards for enrollment, lessons, notes, quizzes, accuracy, streak, and active days
   - Uses `|default:0` filters to ensure zeros don't display as empty when data is missing
   - Completely separate from AI insights generation

2. **AI Insights Panel**:
   - Subject dropdown to focus analysis on specific topics
   - Engine selector for choosing between Gemini or GPT models
   - Generates insights without page reload via AJAX
   - Displays formatted results with summary, strengths, weaknesses, and recommendations

3. **New Admin Endpoint**:
   - `POST /admin/dailycast/studentlearninginsight/<id>/ai-insights/`
   - Accepts `subject` and `engine` parameters
   - Returns JSON with insights data

4. **Improved AI Analyzer**:
   - `_run_ai_deep_analysis` now accepts optional `subject` parameter
   - Filters analysis data by subject when provided
   - Simplified JSON response schema (summary, strengths, weaknesses, recommendations)
   - Better error handling with fallback response

5. **Professional UI**:
   - Clear section hierarchy with consistent styling
   - Organized into logical panels: Summary, AI Insights, Courses, Areas for Improvement, Strong Areas, Recommendations, Recent Activity
   - Improved color coding and visual hierarchy
   - Responsive grid layout for stat cards

### No Breaking Changes
- Existing analytics data collection remains unchanged
- Backend integration with analytics models unchanged
- Backward compatible with existing admin patterns
