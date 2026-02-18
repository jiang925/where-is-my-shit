"""Unified reranker for search results.

This module combines signals from vector search, text search, content quality,
and exact match boost into a single relevance score. ALL ranking happens here.

Architecture principle:
- One reranker, not multiple passes
- Fragment deprioritization is a signal IN the reranker, not a separate filter
- Configurable weights for future model-specific tuning
- Two-tier threshold partitioning for primary/secondary result presentation
"""

from dataclasses import dataclass, field
from typing import Any

from src.app.services.content_quality import calculate_content_quality_score


@dataclass
class ScoringConfig:
    """Configuration for reranking weights and thresholds.

    Default values tuned for BGE-small embedding model based on Phase 17 research.
    """

    vector_weight: float = 0.6
    text_weight: float = 0.3
    quality_weight: float = 0.1
    exact_match_boost: float = 1.5
    primary_threshold: float = 0.75
    secondary_threshold: float = 0.65


@dataclass
class RankedResults:
    """Reranking output with primary and secondary tiers."""

    primary: list[dict[str, Any]] = field(default_factory=list)
    secondary: list[dict[str, Any]] = field(default_factory=list)
    total_considered: int = 0


class UnifiedReranker:
    """Unified reranker combining vector, text, quality, and exact match signals."""

    def __init__(self, config: ScoringConfig | None = None):
        """Initialize reranker with scoring configuration.

        Args:
            config: ScoringConfig instance, uses defaults if None
        """
        self.config = config or ScoringConfig()

    def rerank(
        self,
        vector_results: list[dict[str, Any]],
        text_results: list[dict[str, Any]],
        query: str,
    ) -> RankedResults:
        """Rerank search results by combining multiple signals.

        Args:
            vector_results: Results from vector search with vector_score field
            text_results: Results from text search with text_score field
            query: Search query string

        Returns:
            RankedResults with primary and secondary tiers
        """
        # Handle empty input
        if not vector_results and not text_results:
            return RankedResults(primary=[], secondary=[], total_considered=0)

        # Normalize scores to 0-1 range
        normalized_vector = self._normalize_scores(vector_results, "vector_score")
        normalized_text = self._normalize_scores(text_results, "text_score")

        # Merge results by document ID
        merged = self._merge_results(normalized_vector, normalized_text)

        # Score each result
        scored_results = []
        for result in merged:
            content = result.get("content", "")

            # Calculate quality score
            quality_score = calculate_content_quality_score(content, query)

            # Calculate exact match boost
            exact_match = query.lower() in content.lower() if query and content else False
            boost_multiplier = self.config.exact_match_boost if exact_match else 1.0

            # Weighted combination
            base_score = (
                self.config.vector_weight * result.get("vector_score_norm", 0.0)
                + self.config.text_weight * result.get("text_score_norm", 0.0)
                + self.config.quality_weight * quality_score
            )

            # Apply exact match boost
            final_score = base_score * boost_multiplier

            # Enrich result with scoring metadata
            result["final_score"] = final_score
            result["quality_score"] = quality_score
            result["exact_match"] = exact_match

            scored_results.append(result)

        # Sort by final score descending
        scored_results.sort(key=lambda r: r["final_score"], reverse=True)

        # Partition into primary and secondary tiers
        primary = [r for r in scored_results if r["final_score"] >= self.config.primary_threshold]
        secondary = [
            r
            for r in scored_results
            if self.config.secondary_threshold <= r["final_score"] < self.config.primary_threshold
        ]

        return RankedResults(
            primary=primary,
            secondary=secondary,
            total_considered=len(scored_results),
        )

    def _normalize_scores(self, results: list[dict[str, Any]], score_field: str) -> list[dict[str, Any]]:
        """Normalize scores to 0-1 range using min-max scaling.

        Args:
            results: List of result dicts
            score_field: Name of field containing score to normalize

        Returns:
            Results with added normalized score field (score_field + '_norm')
        """
        if not results:
            return []

        # Extract scores
        scores = [r.get(score_field, 0.0) for r in results]
        min_score = min(scores)
        max_score = max(scores)

        # Avoid division by zero
        score_range = max_score - min_score
        if score_range == 0:
            # All scores are the same, normalize to 1.0
            for r in results:
                r[f"{score_field}_norm"] = 1.0
            return results

        # Min-max normalization
        for r in results:
            raw_score = r.get(score_field, 0.0)
            r[f"{score_field}_norm"] = (raw_score - min_score) / score_range

        return results

    def _merge_results(
        self,
        vector_results: list[dict[str, Any]],
        text_results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Merge vector and text results by document ID.

        Args:
            vector_results: Normalized vector search results
            text_results: Normalized text search results

        Returns:
            Merged results (union of both sets)
        """
        # Index by document ID
        merged_dict = {}

        for result in vector_results:
            doc_id = result["id"]
            merged_dict[doc_id] = result.copy()

        for result in text_results:
            doc_id = result["id"]
            if doc_id in merged_dict:
                # Merge scores from both sources
                merged_dict[doc_id].update(
                    {
                        "text_score": result.get("text_score", 0.0),
                        "text_score_norm": result.get("text_score_norm", 0.0),
                    }
                )
            else:
                # Text-only result
                merged_dict[doc_id] = result.copy()

        return list(merged_dict.values())
