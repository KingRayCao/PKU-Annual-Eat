from datetime import date
from typing import Any, Dict, List

import pytest
import requests

from backend.app.card_client import CARD_TRANSACTIONS_URL, PkuCardClient
from backend.app.errors import UpstreamError


class FakeResponse:
    def __init__(
        self,
        body: Any,
        status_code: int = 200,
        *,
        headers: Dict[str, str] = None,
        text: str = "",
    ) -> None:
        self._body = body
        self.status_code = status_code
        self.headers = headers or {"content-type": "application/json"}
        self.text = text

    def json(self) -> Any:
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class FakeSession:
    def __init__(self, responses: List[FakeResponse]) -> None:
        self.responses = responses
        self.calls: List[Dict[str, Any]] = []

    def post(self, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"url": url, **kwargs})
        return self.responses.pop(0)


def test_fetches_all_pages_using_original_form_contract() -> None:
    session = FakeSession(
        [
            FakeResponse({"total": "3", "rows": [{"ID": "1"}, {"ID": "2"}]}),
            FakeResponse({"total": "3", "rows": [{"ID": "3"}]}),
        ]
    )
    client = PkuCardClient(session=session, page_size=2)

    result = client.fetch_transactions(
        account="account-value",
        hallticket="secret-ticket",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
    )

    assert [row["ID"] for row in result.rows] == ["1", "2", "3"]
    assert len(session.calls) == 2
    assert session.calls[0] == {
        "url": CARD_TRANSACTIONS_URL,
        "cookies": {"hallticket": "secret-ticket"},
        "data": {
            "sdate": "2024-01-01",
            "edate": "2024-12-31",
            "account": "account-value",
            "page": "1",
            "rows": "2",
        },
        "timeout": (5.0, 20.0),
        "allow_redirects": False,
    }
    assert session.calls[1]["data"]["page"] == "2"


def test_redirect_is_reported_as_expired_credentials() -> None:
    client = PkuCardClient(session=FakeSession([FakeResponse({}, status_code=302)]))

    with pytest.raises(UpstreamError) as raised:
        client.fetch_transactions(
            account="a",
            hallticket="expired",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert raised.value.code == "upstream_auth_failed"
    assert raised.value.status_code == 401


def test_html_login_page_is_reported_as_expired_credentials() -> None:
    response = FakeResponse(
        ValueError("not json"),
        headers={"content-type": "text/html; charset=utf-8"},
        text="<html>login</html>",
    )
    client = PkuCardClient(session=FakeSession([response]))

    with pytest.raises(UpstreamError) as raised:
        client.fetch_transactions(
            account="a",
            hallticket="expired",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert raised.value.code == "upstream_auth_failed"


def test_rejects_invalid_rows_shape() -> None:
    client = PkuCardClient(session=FakeSession([FakeResponse({"rows": {}})]))

    with pytest.raises(UpstreamError, match="缺少交易列表") as raised:
        client.fetch_transactions(
            account="a",
            hallticket="h",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert raised.value.code == "upstream_invalid_response"


def test_maps_timeout_without_exposing_credentials() -> None:
    class TimeoutSession:
        def post(self, url: str, **kwargs: Any) -> FakeResponse:
            raise requests.Timeout("network detail")

    client = PkuCardClient(session=TimeoutSession())

    with pytest.raises(UpstreamError) as raised:
        client.fetch_transactions(
            account="sensitive-account",
            hallticket="sensitive-ticket",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert raised.value.status_code == 504
    assert "sensitive" not in raised.value.message
