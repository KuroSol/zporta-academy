-- ============================================
-- PERFORMANCE DATABASE INDEXES
-- Safe to run on production (idempotent)
-- Run these manually on your server MySQL
-- ============================================

-- Courses: Speed up permalink lookups (used in every course detail page)
CREATE INDEX IF NOT EXISTS idx_courses_permalink ON courses_course(permalink);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses_course(is_draft, status);
CREATE INDEX IF NOT EXISTS idx_courses_creator ON courses_course(created_by_id);

-- Lessons: Speed up permalink and course lookups
CREATE INDEX IF NOT EXISTS idx_lessons_permalink ON lessons_lesson(permalink);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons_lesson(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons_lesson(status, is_premium);
CREATE INDEX IF NOT EXISTS idx_lessons_creator ON lessons_lesson(created_by_id);

-- Enrollments: Speed up user enrollment checks (hot path)
CREATE INDEX IF NOT EXISTS idx_enrollment_user_type ON enrollment_enrollment(user_id, enrollment_type, object_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_content ON enrollment_enrollment(content_type_id, object_id);

-- LessonCompletion: Speed up progress tracking
CREATE INDEX IF NOT EXISTS idx_lesson_completion_user ON lessons_lessoncompletion(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completion_lesson ON lessons_lessoncompletion(lesson_id);

-- Quizzes: Speed up course/lesson associations
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes_quiz(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes_quiz(lesson_id);

-- ============================================
-- VERIFY INDEXES (run after applying)
-- ============================================
-- SHOW INDEX FROM courses_course;
-- SHOW INDEX FROM lessons_lesson;
-- SHOW INDEX FROM enrollment_enrollment;
-- SHOW INDEX FROM lessons_lessoncompletion;
