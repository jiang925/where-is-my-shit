import logging
import requests
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

class WimsClient:
    """
    Client for the WIMS Core Engine API.
    """
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.ingest_url = f"{self.base_url}/ingest"

    def ingest(self, payload: Dict[str, Any]) -> bool:
        """
        Send a payload to the ingestion endpoint.
        Returns True if successful, False otherwise.
        """
        try:
            logger.debug(f"Sending payload to {self.ingest_url}")
            response = requests.post(
                self.ingest_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=5  # Short timeout for local service
            )

            if response.status_code in (200, 201, 202):
                return True
            else:
                logger.error(f"Ingest failed: {response.status_code} - {response.text}")
                return False

        except requests.exceptions.ConnectionError:
            logger.error(f"Connection error to WIMS Core at {self.ingest_url}. Is the service running?")
            return False
        except Exception as e:
            logger.error(f"Error during ingest: {e}")
            return False
