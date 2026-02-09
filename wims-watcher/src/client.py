import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class AuthError(Exception):
    """Raised when authentication fails."""
    pass

class WimsClient:
    """
    Client for the WIMS Core Engine API.
    """
    def __init__(self, base_url: str = "http://localhost:8000", password: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.ingest_url = f"{self.base_url}/api/v1/ingest"
        self.auth_url = f"{self.base_url}/api/v1/auth/login"
        self.password = password
        self.token = None
        self.token_file = Path.home() / ".wims" / "token"

        # Try to load existing token
        self._load_token()

        self.session = requests.Session()
        retry_strategy = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _load_token(self):
        if self.token_file.exists():
            try:
                self.token = self.token_file.read_text().strip()
            except Exception as e:
                logger.warning(f"Failed to load token from {self.token_file}: {e}")

    def _save_token(self, token: str):
        try:
            self.token_file.parent.mkdir(parents=True, exist_ok=True)
            self.token_file.write_text(token)
            self.token = token
        except Exception as e:
            logger.warning(f"Failed to save token to {self.token_file}: {e}")

    def login(self) -> bool:
        if not self.password:
            logger.error("Cannot login: No password provided")
            return False

        try:
            logger.info(f"Attempting login to {self.auth_url}")
            response = self.session.post(
                self.auth_url,
                json={"password": self.password},
                headers={"Content-Type": "application/json"},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                if token:
                    self._save_token(token)
                    logger.info("Login successful")
                    return True

            logger.error(f"Login failed: {response.status_code} - {response.text}")
            return False

        except Exception as e:
            logger.error(f"Login error: {e}")
            return False

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def ingest(self, payload: Dict[str, Any]) -> bool:
        """
        Send a payload to the ingestion endpoint.
        Returns True if successful, False otherwise.
        """
        return self._attempt_ingest(payload, retry_auth=True)

    def _attempt_ingest(self, payload: Dict[str, Any], retry_auth: bool = True) -> bool:
        try:
            logger.debug(f"Sending payload to {self.ingest_url}")
            response = self.session.post(
                self.ingest_url,
                json=payload,
                headers=self._get_headers(),
                timeout=5  # Short timeout for local service
            )

            if response.status_code in (200, 201, 202):
                return True

            if response.status_code == 401 and retry_auth:
                logger.info("Authentication failed (401). Attempting re-login...")
                if self.login():
                    # Retry once
                    return self._attempt_ingest(payload, retry_auth=False)
                else:
                    logger.error("Re-login failed.")
                    raise AuthError("Authentication failed after retry")

            logger.error(f"Ingest failed: {response.status_code} - {response.text}")
            return False

        except requests.exceptions.ConnectionError:
            logger.warning(
                f"Connection error to WIMS Core at {self.ingest_url}. "
                "Retries exhausted. Is the service running?"
            )
            return False
        except requests.exceptions.Timeout:
            logger.warning(
                f"Timeout connecting to WIMS Core at {self.ingest_url}. "
                "Retries exhausted."
            )
            return False
        except AuthError:
            raise
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
