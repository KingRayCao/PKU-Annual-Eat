import json
from pathlib import Path

from backend.app.transactions import normalize_transactions


FIXTURE = Path(__file__).parent / "fixtures" / "card_transactions.json"


def test_normalizes_expenses_and_uses_decimal_cents() -> None:
    body = json.loads(FIXTURE.read_text(encoding="utf-8"))

    transactions, warnings = normalize_transactions(body["rows"], ["体育"])

    assert [item.merchant for item in transactions] == ["学一食堂", "家园食堂"]
    assert [item.amountCents for item in transactions] == [1234, 29]
    assert transactions[0].occurredAt == "2024-03-01T07:30:00"
    assert transactions[1].id.startswith("generated-")
    assert any("缺少流水号" in warning for warning in warnings)


def test_skips_invalid_amount_and_missing_merchant() -> None:
    rows = [
        {"MERCNAME": "食堂", "TRANAMT": "not-a-number"},
        {"MERCNAME": " ", "TRANAMT": -10},
    ]

    transactions, warnings = normalize_transactions(rows, [])

    assert transactions == []
    assert len(warnings) == 2


def test_invalid_time_is_returned_as_missing() -> None:
    transactions, warnings = normalize_transactions(
        [{"MERCNAME": "食堂", "TRANAMT": -10, "OCCTIME": "not-a-time"}],
        [],
    )

    assert transactions[0].occurredAt is None
    assert any("缺少时间字段" in warning for warning in warnings)


def test_missing_time_is_returned_as_none_with_warning() -> None:
    transactions, warnings = normalize_transactions(
        [{"ID": "1", "MERCNAME": "食堂", "TRANAMT": -10}], []
    )

    assert transactions[0].occurredAt is None
    assert warnings == ["1 条交易缺少时间字段"]


def test_duplicate_upstream_ids_are_replaced() -> None:
    rows = [
        {"JNUM": "same", "MERCNAME": "食堂", "TRANAMT": -10},
        {"JNUM": "same", "MERCNAME": "食堂", "TRANAMT": -20},
    ]

    transactions, warnings = normalize_transactions(rows, [])

    assert transactions[0].id == "same"
    assert transactions[1].id.startswith("generated-")
    assert transactions[0].id != transactions[1].id
    assert any("流水号重复" in warning for warning in warnings)
