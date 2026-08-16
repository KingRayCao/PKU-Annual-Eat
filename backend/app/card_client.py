"""HTTP client for the PKU campus-card transaction report."""

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Mapping, Optional, Tuple

import requests

from .errors import UpstreamError


CARD_TRANSACTIONS_URL = "https://card.pku.edu.cn/Report/GetPersonTrjn"


@dataclass(frozen=True)
class CardQueryResult:
    rows: List[Mapping[str, Any]]
    warnings: List[str]


class PkuCardClient:
    """Fetch transaction pages without persisting or logging credentials."""

    def __init__(
        self,
        *,
        session: Optional[requests.Session] = None,
        timeout: Tuple[float, float] = (5.0, 20.0),
        page_size: int = 100,
        max_pages: int = 1000,
    ) -> None:
        if page_size <= 0 or max_pages <= 0:
            raise ValueError("page_size and max_pages must be positive")
        self._session = session or requests.Session()
        self._timeout = timeout
        self._page_size = page_size
        self._max_pages = max_pages

    def fetch_transactions(
        self,
        *,
        account: str,
        hallticket: str,
        start_date: date,
        end_date: date,
    ) -> CardQueryResult:
        all_rows: List[Mapping[str, Any]] = []
        warnings: List[str] = []
        expected_total: Optional[int] = None
        previous_signature: Optional[Tuple[str, str, int]] = None

        for page in range(1, self._max_pages + 1):
            payload = {
                "sdate": start_date.isoformat(),
                "edate": end_date.isoformat(),
                "account": account,
                "page": str(page),
                "rows": str(self._page_size),
            }
            response = self._post(payload=payload, hallticket=hallticket)
            body = self._decode_body(response)
            rows = self._validate_rows(body)

            reported_total = self._parse_total(body)
            if reported_total is not None:
                if expected_total is None:
                    expected_total = reported_total
                elif expected_total != reported_total:
                    warnings.append("上游返回的交易总数在分页过程中发生变化，结果可能受实时交易影响")
                    expected_total = max(expected_total, reported_total)

            signature = self._page_signature(rows)
            if rows and signature == previous_signature:
                warnings.append("上游重复返回同一页，已停止分页以避免重复数据")
                break

            all_rows.extend(rows)
            previous_signature = signature

            if not rows:
                break
            if expected_total is not None and len(all_rows) >= expected_total:
                if len(all_rows) > expected_total:
                    warnings.append("上游返回的交易条数超过其声明总数")
                break
            if len(rows) < self._page_size:
                if expected_total is not None and len(all_rows) < expected_total:
                    warnings.append("上游提前结束分页，实际条数少于其声明总数")
                break
        else:
            raise UpstreamError(
                "upstream_pagination_limit",
                "校园卡服务返回的数据页数过多，查询已中止，请缩短日期范围后重试",
            )

        return CardQueryResult(rows=all_rows, warnings=warnings)

    def _post(self, *, payload: Dict[str, str], hallticket: str) -> requests.Response:
        try:
            response = self._session.post(
                CARD_TRANSACTIONS_URL,
                cookies={"hallticket": hallticket},
                data=payload,
                timeout=self._timeout,
                allow_redirects=False,
            )
        except requests.Timeout as exc:
            raise UpstreamError(
                "upstream_timeout",
                "校园卡服务响应超时，请稍后重试",
                504,
            ) from exc
        except requests.RequestException as exc:
            raise UpstreamError(
                "upstream_unavailable",
                "暂时无法连接校园卡服务，请稍后重试",
            ) from exc

        if response.status_code in (301, 302, 401, 403):
            raise UpstreamError(
                "upstream_auth_failed",
                "校园卡登录凭证已失效，请重新获取 hallticket",
                401,
            )
        if not 200 <= response.status_code < 300:
            raise UpstreamError(
                "upstream_http_error",
                "校园卡服务返回异常状态，请稍后重试",
            )
        return response

    @staticmethod
    def _decode_body(response: requests.Response) -> Mapping[str, Any]:
        content_type = response.headers.get("content-type", "").lower()
        response_start = response.text.lstrip()[:1]
        if "text/html" in content_type or response_start == "<":
            raise UpstreamError(
                "upstream_auth_failed",
                "校园卡登录凭证已失效，请重新获取 hallticket",
                401,
            )
        try:
            body = response.json()
        except (TypeError, ValueError) as exc:
            raise UpstreamError(
                "upstream_invalid_json",
                "校园卡服务返回了无法解析的数据，登录凭证可能已失效",
            ) from exc
        if not isinstance(body, Mapping):
            raise UpstreamError(
                "upstream_invalid_response",
                "校园卡服务返回的数据格式不正确",
            )
        return body

    @staticmethod
    def _validate_rows(body: Mapping[str, Any]) -> List[Mapping[str, Any]]:
        if "rows" not in body or not isinstance(body["rows"], list):
            raise UpstreamError(
                "upstream_invalid_response",
                "校园卡服务返回的数据中缺少交易列表",
            )
        rows = body["rows"]
        if not all(isinstance(row, Mapping) for row in rows):
            raise UpstreamError(
                "upstream_invalid_response",
                "校园卡服务返回了格式错误的交易记录",
            )
        return rows

    @staticmethod
    def _parse_total(body: Mapping[str, Any]) -> Optional[int]:
        if "total" not in body or body["total"] in (None, ""):
            return None
        try:
            total = int(body["total"])
        except (TypeError, ValueError) as exc:
            raise UpstreamError(
                "upstream_invalid_response",
                "校园卡服务返回了无效的交易总数",
            ) from exc
        if total < 0:
            raise UpstreamError(
                "upstream_invalid_response",
                "校园卡服务返回了无效的交易总数",
            )
        return total

    @staticmethod
    def _page_signature(rows: List[Mapping[str, Any]]) -> Optional[Tuple[str, str, int]]:
        if not rows:
            return None
        return (repr(rows[0]), repr(rows[-1]), len(rows))
