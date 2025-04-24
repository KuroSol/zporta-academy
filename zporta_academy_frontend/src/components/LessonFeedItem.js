import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LessonFeedItem.module.css';

const LessonFeedItem = ({ lesson, isNext = false }) => {
  const navigate = useNavigate();
  const {
    lesson_title,
    lesson_permalink,
    subject,
    excerpt,
    course_title,
  } = lesson;

  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/lessons/${lesson_permalink}`);
  };

  return (
    <article className={styles.lessonCard}>
      <div className={styles.lessonHeader}>
        <h3 className={styles.lessonTitle}>{lesson_title}</h3>
        {subject && <span className={styles.subjectTag}>{subject.name}</span>}
      </div>
      {course_title && <div className={styles.courseTitle}>{course_title}</div>}

      {excerpt && (
        <div
          className={styles.lessonExcerpt}
          dangerouslySetInnerHTML={{ __html: excerpt }}
        />
      )}

      <div className={styles.cardFooter}>
        <span className={styles.lessonType}>
          {isNext ? 'Next Lesson' : 'Suggested Lesson'}
        </span>
        <span
          className={styles.cardAction}
          onClick={handleNavigate} // Only corner action clickable
        >
          View
        </span>
      </div>
    </article>
  );
};

export default LessonFeedItem;
