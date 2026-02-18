"""Tests for content quality scoring module."""
from src.app.services.content_quality import (
    calculate_content_quality_score,
    is_low_information_content,
)


class TestIsLowInformationContent:
    """Test filler pattern detection."""

    def test_exact_filler_words(self):
        """Test exact matches of filler words."""
        assert is_low_information_content("yes") is True
        assert is_low_information_content("no") is True
        assert is_low_information_content("ok") is True
        assert is_low_information_content("okay") is True
        assert is_low_information_content("continue") is True
        assert is_low_information_content("proceed") is True
        assert is_low_information_content("alright") is True
        assert is_low_information_content("got it") is True
        assert is_low_information_content("sure") is True

    def test_filler_with_punctuation(self):
        """Test filler words with punctuation."""
        assert is_low_information_content("Yes.") is True
        assert is_low_information_content("ok!") is True
        assert is_low_information_content("continue...") is True

    def test_filler_with_whitespace(self):
        """Test filler words with surrounding whitespace."""
        assert is_low_information_content("  ok  ") is True
        assert is_low_information_content("\nyes\n") is True

    def test_case_insensitive(self):
        """Test case insensitive matching."""
        assert is_low_information_content("OK") is True
        assert is_low_information_content("YES") is True
        assert is_low_information_content("Continue") is True

    def test_not_filler_when_part_of_phrase(self):
        """Test that filler words within phrases are not matched."""
        assert is_low_information_content("yes please") is False
        assert is_low_information_content("continue working on the project") is False
        assert is_low_information_content("okay then let's proceed") is False

    def test_substantial_content(self):
        """Test that substantial content is not flagged as filler."""
        assert is_low_information_content("How do I deploy?") is False
        assert is_low_information_content("The implementation looks good") is False
        assert is_low_information_content("Can you explain the algorithm?") is False


class TestCalculateContentQualityScore:
    """Test content quality scoring."""

    def test_filler_content_low_score(self):
        """Test filler content gets very low score."""
        score = calculate_content_quality_score("ok", "something else")
        assert score == 0.1

    def test_very_short_content_low_score(self):
        """Test very short content gets low score."""
        score = calculate_content_quality_score("hi", "greeting")
        assert score < 0.5

    def test_medium_length_content(self):
        """Test medium length content (14 chars) gets medium score."""
        score = calculate_content_quality_score("This is a test", "query")
        # 14 chars -> (14/20)^2 = 0.49
        assert 0.4 <= score < 0.5

    def test_long_content_full_score(self):
        """Test long content gets full score."""
        long_content = "This is a long piece of content with more than twenty characters to ensure full quality score."
        score = calculate_content_quality_score(long_content, "query")
        assert score == 1.0

    def test_exact_full_query_match_override_filler(self):
        """Test exact full-query match overrides filler penalty."""
        # Filler word normally gets 0.1, but exact match should return 1.0
        score = calculate_content_quality_score("continue", "continue")
        assert score == 1.0

        score = calculate_content_quality_score("ok", "ok")
        assert score == 1.0

    def test_exact_full_query_match_override_short(self):
        """Test exact full-query match overrides short content penalty."""
        score = calculate_content_quality_score("hi", "hi")
        assert score == 1.0

    def test_partial_match_no_override(self):
        """Test partial match does NOT override penalties."""
        # "continue" is filler, but query is different, so should get 0.1
        score = calculate_content_quality_score("continue", "continue working")
        assert score == 0.1

    def test_empty_content(self):
        """Test empty content gets zero score."""
        score = calculate_content_quality_score("", "query")
        assert score == 0.0

    def test_whitespace_handling_in_exact_match(self):
        """Test that whitespace is stripped for exact match comparison."""
        score = calculate_content_quality_score("  continue  ", "continue")
        assert score == 1.0

        score = calculate_content_quality_score("continue", "  continue  ")
        assert score == 1.0

    def test_case_insensitive_exact_match(self):
        """Test case insensitive exact match override."""
        score = calculate_content_quality_score("Continue", "continue")
        assert score == 1.0

        score = calculate_content_quality_score("OK", "ok")
        assert score == 1.0
