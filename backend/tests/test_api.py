import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.api import get_card_client
from backend.app.card_client import CardQueryResult
from backend.app.main import app


FIXTURE = Path(__file__).parent / "fixtures" / "card_transactions.json"


class StubCardClient:
    def fetch_transactions(self, **kwargs):
        body = json.loads(FIXTURE.read_text(encoding="utf-8"))
        return CardQueryResult(rows=body["rows"], warnings=[])


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_query_endpoint_returns_shared_contract() -> None:
    app.dependency_overrides[get_card_client] = lambda: StubCardClient()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/transactions/query",
                json={
                    "account": "account-value",
                    "hallticket": "ticket-value",
                    "startDate": "2024-03-01",
                    "endDate": "2024-03-31",
                    "excludedKeywords": ["体育"],
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["meta"] == {
        "startDate": "2024-03-01",
        "endDate": "2024-03-31",
        "totalRows": 4,
        "includedRows": 2,
        "excludedRows": 2,
        "warnings": ["1 条交易缺少流水号，已生成临时标识"],
    }
    assert body["transactions"][0] == {
        "id": "tx-001",
        "occurredAt": "2024-03-01T07:30:00",
        "merchant": "学一食堂",
        "amountCents": 1234,
    }


def test_query_endpoint_validates_date_order() -> None:
    app.dependency_overrides[get_card_client] = lambda: StubCardClient()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/transactions/query",
                json={
                    "account": "a",
                    "hallticket": "h",
                    "startDate": "2024-04-01",
                    "endDate": "2024-03-01",
                    "excludedKeywords": [],
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_query"


def test_query_endpoint_has_readable_validation_errors() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/transactions/query", json={})

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "请求参数校验失败"
