"""Normalize upstream transaction rows into the public API contract."""

import hashlib
from collections import Counter
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Iterable, List, Mapping, Optional, Sequence, Set, Tuple

from .schemas import Transaction


TIME_FIELDS: Sequence[str] = ("OCCTIME",)
ID_FIELDS: Sequence[str] = (
    "JNUM",
    "ID",
    "id",
    "SERIALNO",
    "SYSNO",
    "TRANSNO",
)


def normalize_transactions(
    rows: Iterable[Mapping[str, Any]], excluded_keywords: Sequence[str]
) -> Tuple[List[Transaction], List[str]]:
    normalized: List[Transaction] = []
    issues: Counter[str] = Counter()
    seen_ids: Set[str] = set()
    keywords = tuple(keyword.strip() for keyword in excluded_keywords if keyword.strip())

    for index, row in enumerate(rows):
        amount = _parse_amount(row.get("TRANAMT"))
        if amount is None:
            issues["invalid_amount"] += 1
            continue
        if amount >= 0:
            continue

        merchant_value = row.get("MERCNAME")
        merchant = str(merchant_value).strip() if merchant_value is not None else ""
        if not merchant:
            issues["missing_merchant"] += 1
            continue
        if any(keyword in merchant for keyword in keywords):
            continue

        occurred_at = _extract_occurred_at(row)
        if not occurred_at:
            issues["missing_time"] += 1

        amount_cents = int(
            ((-amount) * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
        upstream_id = _extract_id(row)
        transaction_id = upstream_id
        if not transaction_id or transaction_id in seen_ids:
            if transaction_id:
                issues["duplicate_id"] += 1
            transaction_id = _fallback_id(
                index=index,
                occurred_at=occurred_at,
                merchant=merchant,
                amount_cents=amount_cents,
            )
        if not upstream_id:
            issues["generated_id"] += 1
        seen_ids.add(transaction_id)

        normalized.append(
            Transaction(
                id=transaction_id,
                occurredAt=occurred_at,
                merchant=merchant,
                amountCents=amount_cents,
            )
        )

    warnings = _issue_warnings(issues)
    return normalized, warnings


def _parse_amount(value: Any) -> Optional[Decimal]:
    if isinstance(value, bool) or value is None:
        return None
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not amount.is_finite():
        return None
    return amount


def _extract_occurred_at(row: Mapping[str, Any]) -> Optional[str]:
    value = _first_nonempty(row, TIME_FIELDS)
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None

    candidate = raw.replace("/", "-")
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(candidate).isoformat()
    except ValueError:
        return None


def _extract_id(row: Mapping[str, Any]) -> Optional[str]:
    value = _first_nonempty(row, ID_FIELDS)
    return str(value).strip() if value is not None else None


def _first_nonempty(row: Mapping[str, Any], fields: Sequence[str]) -> Optional[Any]:
    for field in fields:
        value = row.get(field)
        if value is not None and str(value).strip():
            return value
    return None


def _fallback_id(
    *, index: int, occurred_at: Optional[str], merchant: str, amount_cents: int
) -> str:
    source = "\x1f".join((str(index), occurred_at or "", merchant, str(amount_cents)))
    return "generated-" + hashlib.sha256(source.encode("utf-8")).hexdigest()[:20]


def _issue_warnings(issues: Counter[str]) -> List[str]:
    warnings: List[str] = []
    if issues["invalid_amount"]:
        warnings.append(f"{issues['invalid_amount']} 条记录金额无效，已跳过")
    if issues["missing_merchant"]:
        warnings.append(f"{issues['missing_merchant']} 条支出记录缺少商户名称，已跳过")
    if issues["missing_time"]:
        warnings.append(f"{issues['missing_time']} 条交易缺少时间字段")
    if issues["generated_id"]:
        warnings.append(f"{issues['generated_id']} 条交易缺少流水号，已生成临时标识")
    if issues["duplicate_id"]:
        warnings.append(f"{issues['duplicate_id']} 条交易流水号重复，已生成临时标识")
    return warnings
