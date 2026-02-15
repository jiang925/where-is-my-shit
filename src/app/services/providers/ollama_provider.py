"""
Deprecated: OllamaProvider has been replaced by OpenAICompatibleProvider.

This module provides backward compatibility by re-exporting OpenAICompatibleProvider
as OllamaProvider. All new code should use external_api_provider.OpenAICompatibleProvider.
"""

from src.app.services.providers.external_api_provider import OpenAICompatibleProvider as OllamaProvider

__all__ = ["OllamaProvider"]
