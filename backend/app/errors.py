"""Application errors exposed through the HTTP API."""

from typing import Optional


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int,
        *,
        detail: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.detail = detail


class InvalidQueryError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__("invalid_query", message, 422)


class UpstreamError(AppError):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 502,
        *,
        detail: Optional[str] = None,
    ) -> None:
        super().__init__(code, message, status_code, detail=detail)
