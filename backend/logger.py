"""
Sentinel Earth - FloodScope: Redaction Logger
Sanitizes sensitive tokens, API keys, and authorization headers from all logs.
"""

import re
import logging
import os
from backend.config import NEBIUS_API_KEY

BEARER_PATTERN = re.compile(r"(?i)\bBearer\s+[a-zA-Z0-9_\-\.]{8,}", re.IGNORECASE)
AUTH_HEADER_PATTERN = re.compile(r"(?i)(authorization|api[-_]?key)[\"':\s=]+([^,\s\"']+)", re.IGNORECASE)
TOKEN_PATTERN = re.compile(r"\b(nvapi-[a-zA-Z0-9_\-]{16,}|tok_[a-zA-Z0-9]{16,}|sk-[a-zA-Z0-9_\-]{20,})\b")

class RedactionFilter(logging.Filter):
    """Logging filter that redacts API keys, tokens, and Authorization headers."""

    def __init__(self, name: str = ""):
        super().__init__(name)

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.redact(record.msg)
        if record.args:
            if isinstance(record.args, tuple):
                record.args = tuple(self.redact(str(arg)) if isinstance(arg, str) else arg for arg in record.args)
            elif isinstance(record.args, dict):
                record.args = {k: self.redact(str(v)) if isinstance(v, str) else v for k, v in record.args.items()}
        return True

    @staticmethod
    def redact(text: str) -> str:
        if not text:
            return text

        # 1. Redact configured active key if present and non-empty
        active_key = os.getenv("NEBIUS_API_KEY") or NEBIUS_API_KEY
        if active_key and len(active_key) >= 6:
            text = text.replace(active_key, "[REDACTED_API_KEY]")

        # 2. Redact Bearer tokens
        text = BEARER_PATTERN.sub("Bearer [REDACTED_TOKEN]", text)

        # 3. Redact common API key patterns (nvapi-, sk-, tok_)
        text = TOKEN_PATTERN.sub("[REDACTED_TOKEN]", text)

        # 4. Redact key-value pairs like authorization: xxx
        def _redact_kv(match):
            key = match.group(1)
            return f"{key}: [REDACTED]"

        text = AUTH_HEADER_PATTERN.sub(_redact_kv, text)
        return text

def setup_logger(name: str = "floodscope") -> logging.Logger:
    """Configures and returns a sanitized logger with RedactionFilter attached."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Avoid duplicate handlers if re-called
    if not any(isinstance(f, RedactionFilter) for f in logger.filters):
        logger.addFilter(RedactionFilter())

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s")
        handler.setFormatter(formatter)
        handler.addFilter(RedactionFilter())
        logger.addHandler(handler)

    return logger

app_logger = setup_logger("floodscope.api")
