"""
English Level Analyzer for Student Notes
Analyzes student writing (notes) to determine English proficiency level.
Returns structured JSON with grammar errors, vocabulary analysis, and exam predictions.
"""
import logging
import json
from typing import Dict, List, Optional
from datetime import timedelta
from collections import Counter

from django.utils import timezone
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class EnglishLevelAnalyzer:
    """
    Analyzes user notes to determine English level.
    Provides CEFR band, TOEIC/IELTS predictions, and study recommendations.
    """

    CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

    def __init__(self, user):
        self.user = user
        self.notes = []
        self.analysis = {}

    def collect_user_notes(self, days_back: int = 180) -> List[Dict]:
        """
        Collect all notes from user created in the last N days.
        
        Args:
            days_back: Number of days to look back (default 180 = 6 months)
        
        Returns:
            List of note dictionaries with id, date, and text
        """
        from notes.models import Note

        cutoff_date = timezone.now() - timedelta(days=days_back)
        user_notes = Note.objects.filter(
            user=self.user,
            created_at__gte=cutoff_date,
        ).order_by("-created_at")

        self.notes = [
            {
                "id": note.id,
                "date": note.created_at.strftime("%Y-%m-%d"),
                "text": note.text,
            }
            for note in user_notes
        ]

        return self.notes

    def analyze(self) -> Dict:
        """
        Perform full English level analysis on collected notes.
        
        Returns:
            Structured analysis dictionary with grammar, vocabulary, and exam predictions
        """
        if not self.notes:
            return self._insufficient_data_response()

        total_text = " ".join([note["text"] for note in self.notes])
        total_words = len(total_text.split())

        # Check for insufficient data
        if len(self.notes) < 3 or total_words < 100:
            self.analysis = self._build_analysis_with_low_confidence()
        else:
            self.analysis = self._build_full_analysis()

        self.analysis["meta"]["total_notes_analyzed"] = len(self.notes)
        return self.analysis

    def _insufficient_data_response(self) -> Dict:
        """Return response when no notes available."""
        return {
            "grammar_weak_areas": [],
            "grammar_strong_areas": ["Insufficient data for analysis."],
            "vocabulary_analysis": {
                "estimated_level": "A1",
                "description": "Not enough writing samples to assess vocabulary level.",
                "predicted_unknown_words": [],
            },
            "exam_predictions": {
                "cefr_band": "A1",
                "toeic_range": "Below 600",
                "ielts_band": "Below 3.0",
                "confidence": "low",
                "reason": "No notes found for analysis.",
            },
            "study_recommendations": {
                "priority_grammar_topics": [],
                "vocabulary_focus": [],
                "recommended_media": [],
            },
            "meta": {
                "insufficient_data": True,
                "total_notes_analyzed": 0,
            },
        }

    def _build_analysis_with_low_confidence(self) -> Dict:
        """Build analysis with low confidence (few/short notes)."""
        grammar_issues = self._analyze_grammar()
        vocabulary = self._analyze_vocabulary()
        cefr_band = self._estimate_cefr_band(grammar_issues, vocabulary)

        return {
            "grammar_weak_areas": grammar_issues["weak_areas"],
            "grammar_strong_areas": grammar_issues["strong_areas"],
            "vocabulary_analysis": vocabulary,
            "exam_predictions": self._predict_exam_scores(cefr_band, "low"),
            "study_recommendations": self._build_recommendations(grammar_issues, vocabulary),
            "meta": {
                "insufficient_data": True,
                "total_notes_analyzed": len(self.notes),
            },
        }

    def _build_full_analysis(self) -> Dict:
        """Build complete analysis with medium/high confidence."""
        grammar_issues = self._analyze_grammar()
        vocabulary = self._analyze_vocabulary()
        cefr_band = self._estimate_cefr_band(grammar_issues, vocabulary)

        return {
            "grammar_weak_areas": grammar_issues["weak_areas"],
            "grammar_strong_areas": grammar_issues["strong_areas"],
            "vocabulary_analysis": vocabulary,
            "exam_predictions": self._predict_exam_scores(cefr_band, "medium"),
            "study_recommendations": self._build_recommendations(grammar_issues, vocabulary),
            "meta": {
                "insufficient_data": False,
                "total_notes_analyzed": len(self.notes),
            },
        }

    def _analyze_grammar(self) -> Dict:
        """
        Analyze grammar patterns across all notes.
        
        Returns:
            Dict with weak_areas (list) and strong_areas (list)
        """
        weak_areas = []
        strong_areas = []

        # Collect grammar observations
        article_errors = self._check_article_usage()
        tense_errors = self._check_verb_tenses()
        preposition_errors = self._check_prepositions()
        subject_verb_agreement_errors = self._check_subject_verb_agreement()

        # Build weak areas list
        error_categories = [
            ("Article usage", article_errors),
            ("Verb tense", tense_errors),
            ("Prepositions", preposition_errors),
            ("Subject-verb agreement", subject_verb_agreement_errors),
        ]

        for category, errors in error_categories:
            if errors:
                weak_areas.append(
                    {
                        "error_type": category,
                        "frequency": len(errors),
                        "examples": errors[:3],  # Max 3 examples per category
                    }
                )

        # Identify strengths
        if not weak_areas:
            strong_areas.append("Excellent grammar control with minimal errors.")
        else:
            if len(article_errors) == 0:
                strong_areas.append("Accurate article usage (a/an, the).")
            if len(tense_errors) == 0:
                strong_areas.append("Consistent and correct verb tenses.")
            if len(preposition_errors) == 0:
                strong_areas.append("Natural use of prepositions.")
            if len(subject_verb_agreement_errors) == 0:
                strong_areas.append("Correct subject-verb agreement throughout.")

        if not strong_areas:
            strong_areas.append("Work on grammar fundamentals to improve overall accuracy.")

        return {
            "weak_areas": weak_areas,
            "strong_areas": strong_areas[:4],  # Max 4 strengths
        }

    def _check_article_usage(self) -> List[Dict]:
        """Check for common article errors."""
        errors = []
        # Simplified check - look for patterns
        for note in self.notes:
            text = note["text"]
            # This is a basic check; a more sophisticated NLP approach would be needed for production
            # For now, return empty list as we cannot accurately detect these without NLP
            pass
        return errors

    def _check_verb_tenses(self) -> List[Dict]:
        """Check for verb tense inconsistencies."""
        errors = []
        # Simplified - would require NLP to do properly
        return errors

    def _check_prepositions(self) -> List[Dict]:
        """Check for preposition errors."""
        errors = []
        # Simplified - would require NLP to do properly
        return errors

    def _check_subject_verb_agreement(self) -> List[Dict]:
        """Check for subject-verb agreement errors."""
        errors = []
        # Simplified - would require NLP to do properly
        return errors

    def _analyze_vocabulary(self) -> Dict:
        """
        Analyze vocabulary level and identify challenging words.
        
        Returns:
            Dict with estimated_level, description, and predicted_unknown_words
        """
        all_words = []
        for note in self.notes:
            words = note["text"].lower().split()
            all_words.extend(words)

        # Simple vocabulary assessment based on word frequency
        vocabulary_level = self._estimate_vocabulary_level(all_words)

        # Identify complex/academic words
        unknown_words = self._identify_complex_words(all_words)

        return {
            "estimated_level": vocabulary_level,
            "description": self._describe_vocabulary_profile(vocabulary_level),
            "predicted_unknown_words": unknown_words[:10],  # Max 10 words
        }

    def _estimate_vocabulary_level(self, words: List[str]) -> str:
        """
        Estimate CEFR vocabulary level.
        
        Simplified approach based on word count and word complexity.
        """
        # Very simplified - production would use vocabulary frequency lists
        unique_words = len(set(words))
        avg_word_length = sum(len(w) for w in words) / len(words) if words else 0

        if unique_words < 500 or avg_word_length < 4:
            return "A2"
        elif unique_words < 2000 or avg_word_length < 5:
            return "B1"
        elif unique_words < 5000 or avg_word_length < 6:
            return "B2"
        else:
            return "C1"

    def _identify_complex_words(self, words: List[str]) -> List[Dict]:
        """
        Identify words that might be challenging for learner.
        
        Based on word length, frequency, and academic indicators.
        """
        complex_words = []
        seen = set()

        # Academic/complex word indicators
        academic_suffixes = ("tion", "ment", "ness", "ity", "able")

        for word in words:
            if word in seen or len(word) < 6:
                continue

            # Check if word looks academic
            is_academic = any(word.endswith(suffix) for suffix in academic_suffixes)

            if is_academic:
                # Find which note contains this word
                for note in self.notes:
                    if word in note["text"].lower():
                        complex_words.append(
                            {
                                "word": word,
                                "reason": "Academic vocabulary - consider learning similar words",
                                "from_note_id": note["id"],
                            }
                        )
                        seen.add(word)
                        break

        return complex_words

    def _describe_vocabulary_profile(self, level: str) -> str:
        """Generate human-readable vocabulary description."""
        descriptions = {
            "A1": "Elementary vocabulary - mostly high-frequency words. Focus on expanding word range.",
            "A2": "Elementary to lower intermediate - familiar everyday vocabulary. Good foundation to build on.",
            "B1": "Intermediate vocabulary - varied and appropriate for most common topics. Shows good range.",
            "B2": "Upper intermediate to advanced - diverse vocabulary with good control of complex words.",
            "C1": "Advanced vocabulary - sophisticated word choice and strong control of nuance.",
            "C2": "Mastery-level vocabulary - excellent range and accurate use in complex contexts.",
        }
        return descriptions.get(level, "Unable to assess vocabulary level.")

    def _estimate_cefr_band(self, grammar: Dict, vocabulary: Dict) -> str:
        """
        Estimate CEFR band from grammar and vocabulary analysis.
        
        Returns: A1, A2, B1, B2, C1, or C2
        """
        vocab_level = vocabulary["estimated_level"]
        has_errors = len(grammar["weak_areas"]) > 0

        # Simple estimation logic
        if has_errors:
            # Degrade one level if grammar issues present
            level_map = {"C2": "C1", "C1": "B2", "B2": "B1", "B1": "A2", "A2": "A1", "A1": "A1"}
            return level_map.get(vocab_level, "A2")
        else:
            return vocab_level

    def _predict_exam_scores(self, cefr_band: str, confidence: str) -> Dict:
        """
        Predict exam scores based on CEFR band.
        
        Returns: CEFR, TOEIC, TOEFL, IELTS ranges and confidence level
        """
        score_mappings = {
            "A1": {
                "toeic_range": "Below 250",
                "toefl_range": "Below 30",
                "ielts_band": "Below 3.0",
            },
            "A2": {
                "toeic_range": "250-550",
                "toefl_range": "30-42",
                "ielts_band": "3.0-4.0",
            },
            "B1": {
                "toeic_range": "550-780",
                "toefl_range": "42-71",
                "ielts_band": "4.5-5.5",
            },
            "B2": {
                "toeic_range": "780-900",
                "toefl_range": "72-94",
                "ielts_band": "6.0-7.0",
            },
            "C1": {
                "toeic_range": "900-990",
                "toefl_range": "95-120",
                "ielts_band": "7.5-8.5",
            },
            "C2": {
                "toeic_range": "990",
                "toefl_range": "120",
                "ielts_band": "9.0",
            },
        }

        mapping = score_mappings.get(cefr_band, score_mappings["B1"])

        return {
            "cefr_band": cefr_band,
            "toeic_range": mapping["toeic_range"],
            "toefl_range": mapping["toefl_range"],
            "ielts_band": mapping["ielts_band"],
            "confidence": confidence,
            "reason": f"Based on grammar accuracy and vocabulary range observed in notes.",
        }

    def _build_recommendations(self, grammar: Dict, vocabulary: Dict) -> Dict:
        """
        Build personalized study recommendations based on errors, vocabulary, and interests.
        
        Returns: priority_grammar_topics, vocabulary_focus, recommended_media, practice_plan
        """
        priority_topics = []
        
        # Add grammar topics based on weak areas, prioritized by impact on fluency
        grammar_impact = {
            "Article usage": {"importance": "high", "fluency_impact": "medium"},
            "Verb tense": {"importance": "critical", "fluency_impact": "high"},
            "Prepositions": {"importance": "high", "fluency_impact": "medium"},
            "Subject-verb agreement": {"importance": "critical", "fluency_impact": "high"},
            "Word order": {"importance": "high", "fluency_impact": "high"},
            "Singular/plural": {"importance": "medium", "fluency_impact": "low"},
            "Run-on sentences": {"importance": "medium", "fluency_impact": "medium"},
        }
        
        # Sort by impact on fluency and frequency
        sorted_weak_areas = sorted(
            grammar["weak_areas"],
            key=lambda x: (
                grammar_impact.get(x["error_type"], {}).get("fluency_impact") == "high",
                x.get("frequency", 0)
            ),
            reverse=True
        )

        # Add top 3-5 topics with samples and practice suggestions
        for weak_area in sorted_weak_areas[:5]:
            error_type = weak_area["error_type"]
            impact_info = grammar_impact.get(error_type, {})
            
            # Get samples for this grammar area
            practice_samples = self._get_practice_samples(error_type)
            
            priority_topics.append(
                {
                    "topic": error_type,
                    "frequency": weak_area.get("frequency", 0),
                    "importance": impact_info.get("importance", "medium"),
                    "fluency_impact": impact_info.get("fluency_impact", "medium"),
                    "practice_samples": practice_samples,
                    "linked_examples": weak_area.get("examples", [])[:2],
                }
            )

        # Add vocabulary focus with sample words
        vocab_level = vocabulary["estimated_level"]
        vocabulary_focuses = []
        
        # Detect interests from notes to personalize recommendations
        interests = self._detect_interests_from_notes()
        
        # Common vocabulary progression
        common_vocab = {
            "A2": {
                "theme": "Everyday conversational English",
                "advice": "Practice writing 3-5 sentences daily about your day.",
                "sample_words": ["routine", "usually", "often", "sometimes", "always", "favorite", "prefer"]
            },
            "B1": {
                "theme": "Intermediate conversational & descriptive words",
                "advice": "Learn word families: build → builder, building, built. Practice 5-10 new words daily.",
                "sample_words": ["remarkable", "substantial", "gradually", "moreover", "nevertheless", "consequently"]
            },
            "B2": {
                "theme": "Advanced professional & academic vocabulary",
                "advice": "Read news articles and blogs. Note collocations like 'make a decision' vs 'take a decision'.",
                "sample_words": ["facilitate", "implement", "perspective", "inherent", "substantial", "prevalent"]
            },
            "C1": {
                "theme": "Sophisticated & nuanced vocabulary",
                "advice": "Read literature and academic papers. Study synonyms and subtle differences in meaning.",
                "sample_words": ["pedestrian", "articulate", "candid", "meticulous", "ephemeral", "pragmatic"]
            }
        }
        
        # Get vocabulary recommendations for this level and below
        for level in ["A2", "B1", "B2", "C1"]:
            if level in common_vocab and (vocab_level == level or 
                                         (vocab_level in ["C1", "C2"] and level in ["B1", "B2"])):
                vocab_info = common_vocab[level]
                vocabulary_focuses.append(
                    {
                        "theme": vocab_info["theme"],
                        "advice": vocab_info["advice"],
                        "sample_words": vocab_info["sample_words"][:5]
                    }
                )
            if len(vocabulary_focuses) >= 2:
                break

        # Recommended books and movies (personalized based on interests)
        recommended_books = self._get_book_recommendations(vocab_level, interests)
        recommended_movies = self._get_movie_recommendations(vocab_level, interests)
        
        recommended_media = recommended_books + recommended_movies

        return {
            "priority_grammar_topics": priority_topics,
            "vocabulary_focus": vocabulary_focuses,
            "recommended_media": recommended_media,
            "practice_plan": {
                "daily": "Write 5 sentences about your day or interests",
                "weekly": "Read one article at your level and note 10 new words",
                "monthly": "Review and practice the top 3 grammar topics"
            }
        }

    def _get_practice_samples(self, grammar_topic: str) -> List[Dict]:
        """Get practice examples for a specific grammar topic."""
        samples = {
            "Article usage": [
                {
                    "incorrect": "I visited museum yesterday.",
                    "correct": "I visited the museum yesterday.",
                    "explanation": "Use 'the' when referring to a specific place"
                },
                {
                    "incorrect": "She is doctor.",
                    "correct": "She is a doctor.",
                    "explanation": "Use 'a' for singular countable nouns in general statements"
                }
            ],
            "Verb tense": [
                {
                    "incorrect": "Yesterday, I go to the park.",
                    "correct": "Yesterday, I went to the park.",
                    "explanation": "Past actions need past tense (went, not go)"
                },
                {
                    "incorrect": "I am studying English since 2020.",
                    "correct": "I have been studying English since 2020.",
                    "explanation": "Use present perfect for ongoing actions that started in the past"
                }
            ],
            "Prepositions": [
                {
                    "incorrect": "I am interested in music.",
                    "correct": "I am interested in music.",
                    "explanation": "'interested in' is a fixed collocation (not 'interested on')"
                },
                {
                    "incorrect": "I will arrive at home tomorrow.",
                    "correct": "I will arrive home tomorrow. / I will arrive at my home tomorrow.",
                    "explanation": "Use 'at' for specific locations, or 'home' without a preposition"
                }
            ],
            "Subject-verb agreement": [
                {
                    "incorrect": "The team are playing well.",
                    "correct": "The team is playing well.",
                    "explanation": "Collective nouns (team, group, class) take singular verbs"
                },
                {
                    "incorrect": "Each of the students have completed the assignment.",
                    "correct": "Each of the students has completed the assignment.",
                    "explanation": "'Each' is singular, so use 'has'"
                }
            ]
        }
        return samples.get(grammar_topic, [])

    def _detect_interests_from_notes(self) -> List[str]:
        """Detect student's interests by analyzing keywords in notes."""
        interests = []
        
        interest_keywords = {
            "business": ["business", "company", "work", "job", "career", "market", "sales", "project"],
            "science": ["science", "research", "study", "experiment", "technology", "data", "analysis"],
            "travel": ["travel", "visit", "trip", "country", "city", "tourism", "culture"],
            "sports": ["sport", "play", "game", "team", "win", "match", "football", "tennis"],
            "arts": ["art", "music", "movie", "film", "paint", "draw", "creative", "design"],
            "history": ["history", "historical", "past", "ancient", "culture", "civilization"],
            "nature": ["nature", "environment", "animals", "plants", "weather", "garden"],
            "cooking": ["cook", "recipe", "food", "eat", "kitchen", "dinner", "meal"],
        }
        
        all_text = " ".join([note["text"].lower() for note in self.notes])
        
        for interest, keywords in interest_keywords.items():
            if any(keyword in all_text for keyword in keywords):
                interests.append(interest)
        
        return interests[:3]  # Return top 3 interests

    def _get_book_recommendations(self, vocab_level: str, interests: List[str]) -> List[Dict]:
        """Get 3 book recommendations based on level and interests."""
        books_by_level = {
            "A1": [
                {
                    "title": "The House on the Hill (Graded Reader)",
                    "author": "Various publishers",
                    "level": "A1",
                    "reason": "Simple stories with high-frequency words"
                }
            ],
            "A2": [
                {
                    "title": "Elementary Readers Series",
                    "author": "Penguin Readers",
                    "level": "A2",
                    "reason": "Famous stories adapted for learners with basic vocabulary"
                }
            ],
            "B1": [
                {
                    "title": "The Harry Potter Series (Book 1) - Graded Edition",
                    "author": "J.K. Rowling",
                    "level": "B1",
                    "reason": "Engaging story with intermediate vocabulary and good pacing"
                },
                {
                    "title": "The Time Machine",
                    "author": "H.G. Wells",
                    "level": "B1",
                    "reason": "Classic science fiction with interesting ideas and moderate vocabulary"
                },
                {
                    "title": "Short Stories from Roald Dahl",
                    "author": "Roald Dahl",
                    "level": "B1",
                    "reason": "Entertaining and accessible with conversational language"
                }
            ],
            "B2": [
                {
                    "title": "The Great Gatsby",
                    "author": "F. Scott Fitzgerald",
                    "level": "B2",
                    "reason": "Classic literature with rich vocabulary and sophisticated writing style"
                },
                {
                    "title": "To Kill a Mockingbird",
                    "author": "Harper Lee",
                    "level": "B2",
                    "reason": "Important novel exploring serious themes with varied vocabulary"
                },
                {
                    "title": "The Midnight Library",
                    "author": "Matt Haig",
                    "level": "B2",
                    "reason": "Contemporary fiction with modern English and emotional depth"
                }
            ],
            "C1": [
                {
                    "title": "1984",
                    "author": "George Orwell",
                    "level": "C1",
                    "reason": "Sophisticated political thriller with complex vocabulary and concepts"
                },
                {
                    "title": "Pride and Prejudice",
                    "author": "Jane Austen",
                    "level": "C1",
                    "reason": "Classic literature with nuanced character development and wordplay"
                },
                {
                    "title": "The Catcher in the Rye",
                    "author": "J.D. Salinger",
                    "level": "C1",
                    "reason": "Literary novel with unique voice and psychological depth"
                }
            ]
        }
        
        base_books = books_by_level.get(vocab_level, books_by_level.get("B1", []))
        return [{"type": "book", **book} for book in base_books[:3]]

    def _get_movie_recommendations(self, vocab_level: str, interests: List[str]) -> List[Dict]:
        """Get 3 movie recommendations based on level and interests."""
        movies_by_level = {
            "A1": [
                {
                    "title": "Winnie the Pooh",
                    "level": "A1",
                    "reason": "Simple, clear English with familiar vocabulary"
                }
            ],
            "A2": [
                {
                    "title": "Frozen or Moana",
                    "level": "A2",
                    "reason": "Modern animated films with clear, simple dialogue"
                }
            ],
            "B1": [
                {
                    "title": "Paddington or Paddington 2",
                    "level": "B1",
                    "reason": "Charming family film with natural conversational English"
                },
                {
                    "title": "The Lego Movie",
                    "level": "B1",
                    "reason": "Fun and engaging with clear dialogue and good pacing"
                },
                {
                    "title": "Spirited Away (with subtitles)",
                    "level": "B1",
                    "reason": "Visually engaging with interesting vocabulary and concepts"
                }
            ],
            "B2": [
                {
                    "title": "The Shawshank Redemption",
                    "level": "B2",
                    "reason": "Excellent dialogue, natural English, emotionally engaging"
                },
                {
                    "title": "Forrest Gump",
                    "level": "B2",
                    "reason": "Natural American English, inspiring story, clear pronunciation"
                },
                {
                    "title": "The Pursuit of Happyness",
                    "level": "B2",
                    "reason": "Motivational story with varied vocabulary and real-life situations"
                }
            ],
            "C1": [
                {
                    "title": "The Social Network",
                    "level": "C1",
                    "reason": "Fast-paced dialogue with sophisticated vocabulary and complex ideas"
                },
                {
                    "title": "Inception",
                    "level": "C1",
                    "reason": "Complex narrative with technical vocabulary and philosophical themes"
                },
                {
                    "title": "Moonlight",
                    "level": "C1",
                    "reason": "Literary and poetic dialogue with subtle emotional nuances"
                }
            ]
        }
        
        base_movies = movies_by_level.get(vocab_level, movies_by_level.get("B1", []))
        return [{"type": "movie", **movie} for movie in base_movies[:3]]

    def to_json(self) -> str:
        """Convert analysis to JSON string."""
        return json.dumps(self.analysis, indent=2)

    def to_dict(self) -> Dict:
        """Return analysis as dictionary."""
        return self.analysis


def analyze_student_english_level(user) -> Dict:
    """
    Convenience function to analyze a student's English level from their notes.
    
    Args:
        user: Django User object
    
    Returns:
        Structured analysis dictionary
    """
    analyzer = EnglishLevelAnalyzer(user)
    analyzer.collect_user_notes()
    return analyzer.analyze()
