"""Request and response contracts for the transactions API."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class TransactionQueryRequest(BaseModel):
    account: str = Field(..., min_length=1, max_length=128)
    hallticket: str = Field(..., min_length=1, max_length=4096)
    startDate: date
    endDate: date
    excludedKeywords: List[str] = Field(default_factory=list)


class Transaction(BaseModel):
    id: str
    occurredAt: Optional[str]
    merchant: str
    amountCents: int = Field(..., ge=0)


class QueryMeta(BaseModel):
    startDate: date
    endDate: date
    totalRows: int = Field(..., ge=0)
    includedRows: int = Field(..., ge=0)
    excludedRows: int = Field(..., ge=0)
    warnings: List[str]


class TransactionQueryResponse(BaseModel):
    meta: QueryMeta
    transactions: List[Transaction]
