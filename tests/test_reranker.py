"""Tests for unified reranker module."""
import pytest
from src.app.services.reranker import UnifiedReranker, ScoringConfig, RankedResults


def make_result(id, content, vector_score=0.0, text_score=0.0):
    """Helper to create mock search result."""
    return {
        "id": id,
        "content": content,
        "vector_score": vector_score,
        "text_score": text_score
    }


class TestScoringConfig:
    """Test ScoringConfig defaults."""

    def test_default_weights(self):
        """Test default weight configuration."""
        config = ScoringConfig()
        assert config.vector_weight == 0.6
        assert config.text_weight == 0.3
        assert config.quality_weight == 0.1
        assert config.exact_match_boost == 1.5

    def test_default_thresholds(self):
        """Test default threshold configuration."""
        config = ScoringConfig()
        assert config.primary_threshold == 0.75
        assert config.secondary_threshold == 0.65

    def test_custom_config(self):
        """Test custom configuration values."""
        config = ScoringConfig(
            vector_weight=0.5,
            text_weight=0.4,
            quality_weight=0.1,
            exact_match_boost=2.0,
            primary_threshold=0.8,
            secondary_threshold=0.7
        )
        assert config.vector_weight == 0.5
        assert config.text_weight == 0.4
        assert config.exact_match_boost == 2.0


class TestRankedResults:
    """Test RankedResults dataclass."""

    def test_structure(self):
        """Test RankedResults has expected fields."""
        results = RankedResults(
            primary=[{"id": 1}],
            secondary=[{"id": 2}],
            total_considered=5
        )
        assert results.primary == [{"id": 1}]
        assert results.secondary == [{"id": 2}]
        assert results.total_considered == 5


class TestUnifiedReranker:
    """Test UnifiedReranker scoring and ranking."""

    def test_score_combination(self):
        """Test weighted combination of vector and text scores."""
        reranker = UnifiedReranker()

        vector_results = [make_result("doc1", "content", vector_score=0.8)]
        text_results = [make_result("doc1", "content", text_score=0.6)]

        ranked = reranker.rerank(vector_results, text_results, "query")

        # Should combine scores with weights (0.6 * 0.8 + 0.3 * 0.6 + 0.1 * quality)
        assert len(ranked.primary) > 0 or len(ranked.secondary) > 0
        result = ranked.primary[0] if ranked.primary else ranked.secondary[0]
        assert "final_score" in result
        assert result["final_score"] > 0

    def test_exact_match_boost(self):
        """Test exact query string match gets boosted."""
        reranker = UnifiedReranker()

        # Two results with same vector/text scores, one contains query
        vector_results = [
            make_result("doc1", "This contains the search term", vector_score=0.5),
            make_result("doc2", "This does not contain it", vector_score=0.5),
        ]
        text_results = [
            make_result("doc1", "This contains the search term", text_score=0.5),
            make_result("doc2", "This does not contain it", text_score=0.5),
        ]

        ranked = reranker.rerank(vector_results, text_results, "search term")

        # doc1 should be ranked higher due to exact match boost
        all_results = ranked.primary + ranked.secondary
        assert len(all_results) >= 2
        assert all_results[0]["id"] == "doc1"
        assert all_results[0]["exact_match"] is True
        assert all_results[1]["exact_match"] is False

    def test_quality_penalty(self):
        """Test filler content gets lower score than substantial content."""
        reranker = UnifiedReranker()

        # Same vector/text scores, but one is filler
        vector_results = [
            make_result("doc1", "ok", vector_score=0.7),
            make_result("doc2", "This is a substantial answer with good content", vector_score=0.7),
        ]
        text_results = [
            make_result("doc1", "ok", text_score=0.7),
            make_result("doc2", "This is a substantial answer with good content", text_score=0.7),
        ]

        ranked = reranker.rerank(vector_results, text_results, "some query")

        # doc2 should be ranked higher due to better quality score
        all_results = ranked.primary + ranked.secondary
        assert len(all_results) >= 2
        assert all_results[0]["id"] == "doc2"
        assert all_results[0]["quality_score"] > all_results[1]["quality_score"]

    def test_exact_full_query_match_override_on_quality(self):
        """Test exact full-query match overrides quality penalty."""
        reranker = UnifiedReranker()

        # Filler word "continue" as content, searching for "continue"
        vector_results = [make_result("doc1", "continue", vector_score=0.5)]
        text_results = [make_result("doc1", "continue", text_score=0.5)]

        ranked = reranker.rerank(vector_results, text_results, "continue")

        # Should get quality_score=1.0 (not 0.1) due to exact full-query match
        result = (ranked.primary + ranked.secondary)[0]
        assert result["quality_score"] == 1.0

    def test_primary_secondary_tier_split(self):
        """Test results partition into primary and secondary tiers."""
        reranker = UnifiedReranker()

        # Create results with varying scores
        vector_results = [
            make_result("high", "high quality content", vector_score=0.9),
            make_result("medium", "medium quality content", vector_score=0.7),
            make_result("low", "low quality content", vector_score=0.3),
        ]
        text_results = [
            make_result("high", "high quality content", text_score=0.9),
            make_result("medium", "medium quality content", text_score=0.7),
            make_result("low", "low quality content", text_score=0.3),
        ]

        ranked = reranker.rerank(vector_results, text_results, "content")

        # High score should be primary (>= 0.75), medium secondary (>= 0.65), low filtered
        assert len(ranked.primary) >= 1
        assert ranked.primary[0]["id"] == "high"
        assert ranked.primary[0]["final_score"] >= 0.75

        if ranked.secondary:
            assert all(0.65 <= r["final_score"] < 0.75 for r in ranked.secondary)

    def test_empty_results(self):
        """Test empty input returns empty output."""
        reranker = UnifiedReranker()

        ranked = reranker.rerank([], [], "query")

        assert ranked.primary == []
        assert ranked.secondary == []
        assert ranked.total_considered == 0

    def test_score_normalization(self):
        """Test results with different score ranges are normalized."""
        reranker = UnifiedReranker()

        # Vector scores in different range than text scores
        vector_results = [make_result("doc1", "content", vector_score=100.0)]
        text_results = [make_result("doc1", "content", text_score=1.0)]

        ranked = reranker.rerank(vector_results, text_results, "query")

        # Should normalize to 0-1 range before combining
        result = (ranked.primary + ranked.secondary)[0]
        assert 0.0 <= result["final_score"] <= 1.5  # Can be > 1.0 due to exact_match_boost

    def test_all_below_primary_threshold(self):
        """Test when all results below primary but some above secondary."""
        reranker = UnifiedReranker()

        # All scores below primary threshold (0.75)
        vector_results = [
            make_result("doc1", "medium content", vector_score=0.65),
            make_result("doc2", "medium content 2", vector_score=0.68),
        ]
        text_results = [
            make_result("doc1", "medium content", text_score=0.65),
            make_result("doc2", "medium content 2", text_score=0.68),
        ]

        ranked = reranker.rerank(vector_results, text_results, "content")

        # Primary should be empty, secondary should have results
        assert ranked.primary == []
        assert len(ranked.secondary) >= 1

    def test_merge_vector_and_text_results(self):
        """Test reranker merges results from both sources."""
        reranker = UnifiedReranker()

        # Different results in vector and text
        vector_results = [make_result("doc1", "vector content", vector_score=0.8)]
        text_results = [make_result("doc2", "text content", text_score=0.8)]

        ranked = reranker.rerank(vector_results, text_results, "content")

        # Should have both documents
        all_results = ranked.primary + ranked.secondary
        ids = [r["id"] for r in all_results]
        assert "doc1" in ids
        assert "doc2" in ids

    def test_result_enrichment(self):
        """Test results are enriched with scoring metadata."""
        reranker = UnifiedReranker()

        vector_results = [make_result("doc1", "some content", vector_score=0.8)]
        text_results = [make_result("doc1", "some content", text_score=0.7)]

        ranked = reranker.rerank(vector_results, text_results, "query")

        result = (ranked.primary + ranked.secondary)[0]
        assert "final_score" in result
        assert "quality_score" in result
        assert "exact_match" in result
        assert isinstance(result["final_score"], float)
        assert isinstance(result["quality_score"], float)
        assert isinstance(result["exact_match"], bool)
