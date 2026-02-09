import logging
import logging.config
import sys
from typing import Any

import structlog
from structlog.types import Processor

from src.app.core.config import get_settings

def setup_logging() -> None:
    settings = get_settings()

    shared_processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    structlog.configure(
        processors=shared_processors + [
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Intercept standard library logging
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.processors.JSONRenderer(),
                "foreign_pre_chain": shared_processors,
            },
        },
        "handlers": {
            "default": {
                "level": settings.LOG_LEVEL,
                "class": "logging.StreamHandler",
                "formatter": "json",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "": {
                "handlers": ["default"],
                "level": settings.LOG_LEVEL,
                "propagate": True,
            },
            "uvicorn.access": {
                "handlers": ["default"],
                "level": settings.LOG_LEVEL,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": settings.LOG_LEVEL,
                "propagate": False,
            },
        },
    })
