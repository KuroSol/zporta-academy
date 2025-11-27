-- ============================================
-- PERFORMANCE DATABASE INDEXES (SAFE VERSION)
-- MySQL-compatible with duplicate protection
-- Run on server: mysql -u zporta_user -p zporta_db < PERFORMANCE_DB_INDEXES_SAFE.sql
-- ============================================

-- Drop existing indexes first (ignore errors if they don't exist)
DROP INDEX IF EXISTS idx_courses_permalink ON courses_course;
DROP INDEX IF EXISTS idx_courses_status ON courses_course;
DROP INDEX IF EXISTS idx_courses_creator ON courses_course;
DROP INDEX IF EXISTS idx_lessons_permalink ON lessons_lesson;
DROP INDEX IF EXISTS idx_lessons_course ON lessons_lesson;
DROP INDEX IF EXISTS idx_lessons_status ON lessons_lesson;
DROP INDEX IF EXISTS idx_lessons_creator ON lessons_lesson;
DROP INDEX IF EXISTS idx_enrollment_user_type ON enrollment_enrollment;
DROP INDEX IF EXISTS idx_enrollment_content ON enrollment_enrollment;
DROP INDEX IF EXISTS idx_lesson_completion_user ON lessons_lessoncompletion;
DROP INDEX IF EXISTS idx_lesson_completion_lesson ON lessons_lessoncompletion;
DROP INDEX IF EXISTS idx_quizzes_course ON quizzes_quiz;
DROP INDEX IF EXISTS idx_quizzes_lesson ON quizzes_quiz;

-- Now create fresh indexes
-- Courses: Speed up permalink lookups (used in every course detail page)
CREATE INDEX idx_courses_permalink ON courses_course(permalink);
CREATE INDEX idx_courses_status ON courses_course(is_draft, status);
CREATE INDEX idx_courses_creator ON courses_course(created_by_id);

-- Lessons: Speed up permalink and course lookups
CREATE INDEX idx_lessons_permalink ON lessons_lesson(permalink);
CREATE INDEX idx_lessons_course ON lessons_lesson(course_id);
CREATE INDEX idx_lessons_status ON lessons_lesson(status, is_premium);
CREATE INDEX idx_lessons_creator ON lessons_lesson(created_by_id);

-- Enrollments: Speed up user enrollment checks (hot path)
CREATE INDEX idx_enrollment_user_type ON enrollment_enrollment(user_id, enrollment_type, object_id);
CREATE INDEX idx_enrollment_content ON enrollment_enrollment(content_type_id, object_id);

-- LessonCompletion: Speed up progress tracking
CREATE INDEX idx_lesson_completion_user ON lessons_lessoncompletion(user_id, lesson_id);
CREATE INDEX idx_lesson_completion_lesson ON lessons_lessoncompletion(lesson_id);

-- Quizzes: Speed up course/lesson associations
CREATE INDEX idx_quizzes_course ON quizzes_quiz(course_id);
CREATE INDEX idx_quizzes_lesson ON quizzes_quiz(lesson_id);

-- Verify indexes were created
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = 'zporta_db'
    AND INDEX_NAME LIKE 'idx_%'
ORDER BY 
    TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
