import logging
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class AuthError(Exception):
    """Raised when authentication fails."""

    pass


class WimsClient:
    """
    Client for the WIMS Core Engine API using API Key authentication.
    """

    def __init__(self, base_url: str = "http://localhost:8000", api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.ingest_url = f"{self.base_url}/api/v1/ingest"
        self.api_key = api_key

        if not self.api_key:
            logger.warning("No API Key provided to WimsClient. Requests may fail.")

        self.session = requests.Session()
        retry_strategy = Retry(
            total=5, backoff_factor=1, status_forcelist=[500, 502, 503, 504], allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _get_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def ingest(self, payload: dict[str, Any]) -> bool:
        """
        Send a payload to the ingestion endpoint.
        Returns True if successful, False otherwise.
        """
        try:
            logger.debug(f"Sending payload to {self.ingest_url}")
            response = self.session.post(
                self.ingest_url,
                json=payload,
                headers=self._get_headers(),
                timeout=5,  # Short timeout for local service
            )

            if response.status_code in (200, 201, 202):
                return True

            if response.status_code == 401 or response.status_code == 403:
                logger.error(f"Authentication failed: {response.status_code}. Check your API Key.")
                return False

            logger.error(f"Ingest failed: {response.status_code} - {response.text}")
            return False

        except requests.exceptions.ConnectionError:
            logger.warning(
                f"Connection error to WIMS Core at {self.ingest_url}. Retries exhausted. Is the service running?"
            )
            return False
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout connecting to WIMS Core at {self.ingest_url}. Retries exhausted.")
            return False
        except Exception as e:
            logger.error(f"Error during ingest: {e}")
            return False

    def check_connection(self) -> bool:
        """
        Checks if the Core Engine is reachable.
        """
        try:
            # Bypass self.session to avoid retries for this quick check
            requests.get(self.base_url, timeout=1)
            return True
        except Exception:
            return False
