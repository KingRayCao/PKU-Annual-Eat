"""Transaction query use case."""

from .card_client import PkuCardClient
from .errors import InvalidQueryError
from .schemas import QueryMeta, TransactionQueryRequest, TransactionQueryResponse
from .transactions import normalize_transactions


def query_transactions(
    query: TransactionQueryRequest, client: PkuCardClient
) -> TransactionQueryResponse:
    if query.startDate > query.endDate:
        raise InvalidQueryError("开始日期不能晚于结束日期")
    if not query.account.strip():
        raise InvalidQueryError("account 不能为空")
    if not query.hallticket.strip():
        raise InvalidQueryError("hallticket 不能为空")

    result = client.fetch_transactions(
        account=query.account,
        hallticket=query.hallticket,
        start_date=query.startDate,
        end_date=query.endDate,
    )
    transactions, normalization_warnings = normalize_transactions(
        result.rows, query.excludedKeywords
    )
    total_rows = len(result.rows)
    included_rows = len(transactions)

    return TransactionQueryResponse(
        meta=QueryMeta(
            startDate=query.startDate,
            endDate=query.endDate,
            totalRows=total_rows,
            includedRows=included_rows,
            excludedRows=total_rows - included_rows,
            warnings=result.warnings + normalization_warnings,
        ),
        transactions=transactions,
    )
