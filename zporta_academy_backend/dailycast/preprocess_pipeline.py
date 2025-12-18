"""
Preprocess Pipeline: Normalize, clean, and compact user notes before LLM call.
Goal: Reduce token usage while preserving quality.
"""

import re
import hashlib
import json
from typing import Dict, List, Optional
from datetime import datetime


class PreprocessPipeline:
    """
    Cleans and normalizes text input before sending to LLM.
    Outputs compact JSON payload.
    """
    
    # Boilerplate patterns to remove
    BOILERPLATE_PATTERNS = [
        r"^(hello|hi|hey|thanks|thank you)[\.,\s]*",  # Greetings at start
        r"[\s\.]+(regards|sincerely|yours truly|best|cheers)[\s\.]*$",  # Sign-offs
        r"(please|kindly|would you mind|can you)\s+(help me|check|review|correct)",  # Politeness filler
    ]
    
    # Common contractions and expansions
    CONTRACTIONS = {
        "don't": "do not",
        "doesn't": "does not",
        "didn't": "did not",
        "won't": "will not",
        "wouldn't": "would not",
        "can't": "cannot",
        "couldn't": "could not",
        "shouldn't": "should not",
        "aren't": "are not",
        "isn't": "is not",
        "wasn't": "was not",
        "weren't": "were not",
        "haven't": "have not",
        "hasn't": "has not",
        "hadn't": "had not",
        "i'm": "i am",
        "you're": "you are",
        "he's": "he is",
        "she's": "she is",
        "it's": "it is",
        "we're": "we are",
        "they're": "they are",
    }
    
    # Stop words to identify filler
    ENGLISH_STOPWORDS = {
        "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
        "has", "he", "in", "is", "it", "its", "of", "on", "or", "that", "the",
        "to", "was", "will", "with", "i", "you", "we", "they", "she", "he",
    }
    
    def __init__(self, max_sentences: int = 20, max_tokens_estimate: int = 500):
        """
        Args:
            max_sentences: Max sentences to keep after cleanup.
            max_tokens_estimate: Target token budget (rough estimate).
        """
        self.max_sentences = max_sentences
        self.max_tokens_estimate = max_tokens_estimate
    
    def process(self, note_text: str, user_level: str = "B1", goals: Optional[str] = None) -> Dict:
        """
        Full preprocessing pipeline.
        
        Args:
            note_text: Raw user input.
            user_level: Estimated English level (A1-C2).
            goals: User's learning goals (optional).
        
        Returns:
            Compact dict with cleaned text, summary, metadata.
        """
        # Step 1: Normalize
        normalized = self._normalize(note_text)
        
        # Step 2: Remove boilerplate
        cleaned = self._remove_boilerplate(normalized)
        
        # Step 3: Segment sentences
        sentences = self._segment_sentences(cleaned)
        
        # Step 4: Score and rank sentences
        ranked = self._rank_sentences(sentences)
        
        # Step 5: Keep top N
        kept_sentences = [s for s, _ in ranked[:self.max_sentences]]
        
        # Step 6: Generate summary (top 3 most important sentences)
        summary = " ".join([s for s, _ in ranked[:3]])
        
        # Step 7: Compute hash
        text_hash = self._hash_text(note_text)
        
        # Step 8: Build compact JSON
        payload = {
            "user_level": user_level,
            "goals": goals or "general English improvement",
            "cleaned_text": " ".join(kept_sentences),
            "summary": summary,
            "original_length": len(note_text),
            "cleaned_length": sum(len(s) for s in kept_sentences),
            "sentence_count": len(kept_sentences),
            "text_hash": text_hash,
            "timestamp": datetime.utcnow().isoformat(),
            "token_estimate": self._estimate_tokens(" ".join(kept_sentences)),
        }
        
        return payload
    
    def _normalize(self, text: str) -> str:
        """Lowercase, remove extra whitespace, fix common typos."""
        # Lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r"\s+", " ", text).strip()
        
        # Fix common typos (optional, light touch)
        text = re.sub(r"teh\b", "the", text)
        text = re.sub(r"recieve", "receive", text)
        
        # Expand contractions
        for contraction, expansion in self.CONTRACTIONS.items():
            text = re.sub(rf"\b{re.escape(contraction)}\b", expansion, text)
        
        return text
    
    def _remove_boilerplate(self, text: str) -> str:
        """Remove greeting/sign-off patterns."""
        for pattern in self.BOILERPLATE_PATTERNS:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
        return text.strip()
    
    def _segment_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        # Simple sentence splitter: split on . ! ? followed by space
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences
    
    def _rank_sentences(self, sentences: List[str]) -> List[tuple]:
        """
        Score sentences by informativeness.
        Higher score = more unique words, longer, fewer stopwords.
        
        Returns: List of (sentence, score) tuples.
        """
        ranked = []
        for sentence in sentences:
            words = sentence.split()
            unique_words = set(w.lower() for w in words if w.isalpha())
            stopword_count = len(unique_words & self.ENGLISH_STOPWORDS)
            
            # Score: unique words - stopword penalty + length bonus
            score = len(unique_words) - (0.5 * stopword_count) + (len(words) * 0.1)
            ranked.append((sentence, score))
        
        # Sort by score descending
        ranked.sort(key=lambda x: x[1], reverse=True)
        return ranked
    
    def _hash_text(self, text: str) -> str:
        """Generate a hash of the original text for caching."""
        return hashlib.md5(text.encode()).hexdigest()[:16]
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough estimate: ~1 token per 4 characters."""
        return max(1, len(text) // 4)


# Singleton instance
preprocess = PreprocessPipeline(max_sentences=20, max_tokens_estimate=500)


def preprocess_note(note_text: str, user_level: str = "B1", goals: Optional[str] = None) -> Dict:
    """Public interface."""
    return preprocess.process(note_text, user_level=user_level, goals=goals)
