"""HTTP routes and dependencies."""

from fastapi import APIRouter, Depends

from .card_client import PkuCardClient
from .schemas import TransactionQueryRequest, TransactionQueryResponse
from .service import query_transactions


router = APIRouter(prefix="/api/v1")


def get_card_client() -> PkuCardClient:
    return PkuCardClient()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/transactions/query", response_model=TransactionQueryResponse)
def transaction_query(
    query: TransactionQueryRequest,
    client: PkuCardClient = Depends(get_card_client),
) -> TransactionQueryResponse:
    return query_transactions(query, client)
