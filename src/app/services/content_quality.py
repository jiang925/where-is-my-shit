"""Content quality scoring for search results.

This module identifies low-information content (filler patterns like "yes", "ok", "continue")
and applies length-based quality scoring to deprioritize short fragments in search results.

Key behaviors:
- Exact full-query match overrides all penalties (searching "continue" boosts "continue" fragment)
- Filler patterns get very low score (0.1)
- Short content (< 20 chars) gets quadratic penalty
- Substantial content (>= 20 chars) gets full score (1.0)
"""
import re


# Filler patterns: exact matches for low-information words
# Matches: yes, no, ok, okay, continue, proceed, alright, "got it", sure
# Case insensitive, allows surrounding whitespace and trailing punctuation
FILLER_PATTERN = re.compile(
    r"^\s*(yes|no|ok|okay|continue|proceed|alright|got\s+it|sure)[.,!?]*\s*$",
    re.IGNORECASE
)


def is_low_information_content(text: str) -> bool:
    """Check if text is a low-information filler pattern.

    Args:
        text: Content to check

    Returns:
        True if text matches filler pattern, False otherwise

    Examples:
        >>> is_low_information_content("yes")
        True
        >>> is_low_information_content("continue")
        True
        >>> is_low_information_content("OK")
        True
        >>> is_low_information_content("yes please")
        False
    """
    return FILLER_PATTERN.match(text) is not None


def calculate_content_quality_score(content: str, query: str) -> float:
    """Calculate quality score for content based on information density.

    Scoring logic:
    1. Empty content -> 0.0
    2. Exact full-query match -> 1.0 (override all penalties)
    3. Filler pattern -> 0.1
    4. Length < 20 chars -> (length / 20) ** 2 (quadratic penalty)
    5. Otherwise -> 1.0

    Args:
        content: Content to score
        query: Search query

    Returns:
        Quality score from 0.0 to 1.0

    Examples:
        >>> calculate_content_quality_score("ok", "something else")
        0.1
        >>> calculate_content_quality_score("continue", "continue")
        1.0
        >>> calculate_content_quality_score("hi", "greeting")
        0.1
        >>> calculate_content_quality_score("This is substantial content", "query")
        1.0
    """
    # Handle empty content
    if not content.strip():
        return 0.0

    # Check exact full-query match (case-insensitive, whitespace-stripped)
    # This overrides all penalties - searching "continue" should boost "continue" fragment
    if query.strip().lower() == content.strip().lower():
        return 1.0

    # Check for filler pattern
    if is_low_information_content(content):
        return 0.1

    # Length-based scoring with quadratic penalty for short content
    min_length = 20
    content_length = len(content.strip())

    if content_length < min_length:
        # Quadratic penalty: (length / min_length) ** 2
        return (content_length / min_length) ** 2

    # Substantial content gets full score
    return 1.0
