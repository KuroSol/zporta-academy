-- ============================================
-- PERFORMANCE DATABASE INDEXES (UNIVERSAL)
-- Works on all MySQL/MariaDB versions
-- Run: mysql -u zporta_user -p zporta_db < PERFORMANCE_DB_INDEXES_UNIVERSAL.sql
-- ============================================

-- Courses indexes
ALTER TABLE courses_course ADD INDEX idx_courses_permalink (permalink);
ALTER TABLE courses_course ADD INDEX idx_courses_status (is_draft);
ALTER TABLE courses_course ADD INDEX idx_courses_creator (created_by_id);

-- Lessons indexes
ALTER TABLE lessons_lesson ADD INDEX idx_lessons_permalink (permalink);
ALTER TABLE lessons_lesson ADD INDEX idx_lessons_course (course_id);
ALTER TABLE lessons_lesson ADD INDEX idx_lessons_status (status, is_premium);
ALTER TABLE lessons_lesson ADD INDEX idx_lessons_creator (created_by_id);

-- Enrollments indexes
ALTER TABLE enrollment_enrollment ADD INDEX idx_enrollment_user_type (user_id, enrollment_type, object_id);
ALTER TABLE enrollment_enrollment ADD INDEX idx_enrollment_content (content_type_id, object_id);

-- LessonCompletion indexes
ALTER TABLE lessons_lessoncompletion ADD INDEX idx_lesson_completion_user (user_id, lesson_id);
ALTER TABLE lessons_lessoncompletion ADD INDEX idx_lesson_completion_lesson (lesson_id);

-- Quizzes indexes
ALTER TABLE quizzes_quiz ADD INDEX idx_quizzes_course (course_id);
ALTER TABLE quizzes_quiz ADD INDEX idx_quizzes_lesson (lesson_id);

-- Show created indexes
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = 'zporta_db'
    AND INDEX_NAME LIKE 'idx_%'
ORDER BY 
    TABLE_NAME, INDEX_NAME;
