"""
JSON Schema and patterns for bulk import
This file provides the expected structure for bulk uploads
"""

BULK_IMPORT_SCHEMA = {
    "version": "1.0",
    "exam_types": ["TOEIC", "TOEFL", "IELTS", "CEFR"],
    "description": "Schema for bulk importing courses, lessons, and quizzes",
    "courses": [
        {
            "title": "string (required, max 200)",
            "description": "string (HTML supported, required)",
            "subject_name": "string (required, must exist in system)",
            "course_type": "string (free or premium, default: free)",
            "price": "decimal (only for premium courses)",
            "is_premium": "boolean (default: false)",
            "tag_names": ["list of strings"],
            "seo_title": "string (optional, max 60)",
            "seo_description": "string (optional, max 160)",
            "focus_keyword": "string (optional)",
            "og_title": "string (optional)",
            "og_description": "string (optional)",
            "selling_points": ["max 3 benefits/features"],
            "lessons": [
                {
                    "title": "string (required, max 200)",
                    "content": "string (HTML content, required)",
                    "position": "integer (order in course)",
                    "is_premium": "boolean (default: false)",
                    "content_type": "text | video | quiz (default: text)",
                    "video_url": "URL (optional, for video type)",
                    "tag_names": ["list of strings"],
                    "template": "modern | minimal | dark (default: modern)",
                    "accent_color": "hex color (default: #3498db)",
                    "seo_title": "string (optional)",
                    "seo_description": "string (optional)",
                    "quizzes": [
                        {
                            "title": "string (required, max 200) - Add exam type: TOEIC, TOEFL, IELTS, CEFR",
                            "content": "string (optional explanation)",
                            "quiz_type": "free | premium (default: free)",
                            "difficulty_level": "easy | medium | hard | expert",
                            "tag_names": ["TOEIC Listening", "TOEFL Speaking", "IELTS Academic"],
                            "seo_title": "string (optional)",
                            "seo_description": "string (optional)",
                            "questions": [
                                {
                                    "question_text": "string (required)",
                                    "question_type": "mcq | multi | short | dragdrop | sort (default: mcq)",
                                    "option1": "string (for mcq/multi)",
                                    "option2": "string (for mcq/multi)",
                                    "option3": "string (for mcq/multi)",
                                    "option4": "string (optional, for mcq/multi)",
                                    "correct_answer": "string (for short answer)",
                                    "correct_options": "[0, 2] (for multi-select, 0-indexed)",
                                    "hint1": "string (optional)",
                                    "hint2": "string (optional)",
                                    "question_data": "object (for dragdrop/sort only)"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

# Example JSON for TOEIC
TOEIC_EXAMPLE = {
    "courses": [
        {
            "title": "TOEIC Listening & Reading Preparation",
            "description": "<p>Complete TOEIC preparation course</p>",
            "subject_name": "English",
            "course_type": "premium",
            "price": "99.99",
            "tag_names": ["TOEIC", "Listening", "Reading", "Exam Prep"],
            "lessons": [
                {
                    "title": "TOEIC Listening - Part 1: Photographs",
                    "content": "<h2>Part 1 Strategy</h2><p>Learn how to answer photo questions...</p>",
                    "position": 1,
                    "tag_names": ["TOEIC", "Listening"],
                    "quizzes": [
                        {
                            "title": "TOEIC Listening - Part 1 Mock Test",
                            "difficulty_level": "medium",
                            "tag_names": ["TOEIC Listening"],
                            "questions": [
                                {
                                    "question_text": "What is the woman doing?",
                                    "question_type": "mcq",
                                    "option1": "She is reading a newspaper",
                                    "option2": "She is walking down the street",
                                    "option3": "She is sitting at a desk",
                                    "option4": "She is cooking",
                                    "correct_answer": "option2"
                                }
                            ]
                        }
                    ]
                },
                {
                    "title": "TOEIC Reading - Part 5: Incomplete Sentences",
                    "content": "<h2>Part 5 Strategy</h2><p>Master grammar and vocabulary...</p>",
                    "position": 2,
                    "tag_names": ["TOEIC", "Reading"],
                    "quizzes": [
                        {
                            "title": "TOEIC Reading - Part 5 Mock Test",
                            "difficulty_level": "medium",
                            "tag_names": ["TOEIC Reading"],
                            "questions": [
                                {
                                    "question_text": "The manager decided to ___ the meeting until Friday.",
                                    "question_type": "mcq",
                                    "option1": "postpone",
                                    "option2": "postponed",
                                    "option3": "postponing",
                                    "option4": "postpones",
                                    "correct_answer": "option1"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

# Example JSON for TOEFL
TOEFL_EXAMPLE = {
    "courses": [
        {
            "title": "TOEFL iBT Preparation",
            "description": "<p>Complete TOEFL iBT course</p>",
            "subject_name": "English",
            "course_type": "premium",
            "price": "149.99",
            "tag_names": ["TOEFL", "Speaking", "Writing", "Exam Prep"],
            "lessons": [
                {
                    "title": "TOEFL Speaking - Independent Task",
                    "content": "<h2>Independent Speaking</h2><p>Learn to speak about familiar topics...</p>",
                    "position": 1,
                    "tag_names": ["TOEFL", "Speaking"],
                    "quizzes": [
                        {
                            "title": "TOEFL Speaking - Independent Task Practice",
                            "difficulty_level": "hard",
                            "tag_names": ["TOEFL Speaking"],
                            "questions": [
                                {
                                    "question_text": "Describe a person who has had a great influence on you. Please include specific examples and details.",
                                    "question_type": "short",
                                    "hint1": "Think of someone important in your life",
                                    "hint2": "Include 2-3 specific examples of their influence"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

# Example JSON for IELTS
IELTS_EXAMPLE = {
    "courses": [
        {
            "title": "IELTS Academic Preparation",
            "description": "<p>Complete IELTS Academic course</p>",
            "subject_name": "English",
            "course_type": "premium",
            "price": "129.99",
            "tag_names": ["IELTS", "Academic", "Listening", "Writing"],
            "lessons": [
                {
                    "title": "IELTS Listening - Section 1",
                    "content": "<h2>Section 1: Conversation</h2><p>Practice listening to everyday conversations...</p>",
                    "position": 1,
                    "tag_names": ["IELTS", "Listening"],
                    "quizzes": [
                        {
                            "title": "IELTS Listening - Section 1 Practice",
                            "difficulty_level": "easy",
                            "tag_names": ["IELTS Listening"],
                            "questions": [
                                {
                                    "question_text": "What is the purpose of the conversation?",
                                    "question_type": "mcq",
                                    "option1": "To book a hotel",
                                    "option2": "To complain about a service",
                                    "option3": "To apply for a job",
                                    "option4": "To get directions",
                                    "correct_answer": "option1"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}

# Example JSON for CEFR levels
CEFR_EXAMPLE = {
    "courses": [
        {
            "title": "English A1 - Elementary (CEFR)",
            "description": "<p>Complete A1 level course</p>",
            "subject_name": "English",
            "course_type": "free",
            "tag_names": ["CEFR", "A1", "Elementary"],
            "lessons": [
                {
                    "title": "A1 - Basic Greetings",
                    "content": "<h2>Greetings</h2><p>Learn basic greetings...</p>",
                    "position": 1,
                    "tag_names": ["CEFR", "A1"],
                    "quizzes": [
                        {
                            "title": "A1 CEFR Writing Exercise - Introduce Yourself",
                            "difficulty_level": "easy",
                            "tag_names": ["CEFR Writing"],
                            "questions": [
                                {
                                    "question_text": "Write 30-50 words introducing yourself (name, age, nationality)",
                                    "question_type": "short"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
