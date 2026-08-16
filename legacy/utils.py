def filter_data(item,EXCLUDED_MERCHANTS):
    """
    过滤掉商户名称包含任意排除关键词的记录。

    Args:
        item (dict): 表示交易记录的字典，必须包含键 "MERCNAME"。
        EXCLUDED_MERCHANTS (list of str): 包含需要排除的关键词的列表。如果商户名称包含列表中的任意关键词，该记录将被过滤掉。

    Returns:
        bool: 如果商户名称不包含任何排除关键词，返回 True；否则返回 False。

    Example:
        >>> EXCLUDED_MERCHANTS = ["体育教研部", "图书馆"]
        >>> item = {"MERCNAME": "体育教研部场地租赁", "TRANAMT": -100}
        >>> filter_data(item, EXCLUDED_MERCHANTS)
        False

        >>> item = {"MERCNAME": "食堂消费", "TRANAMT": -30}
        >>> filter_data(item, EXCLUDED_MERCHANTS)
        True
    """
    merchant_name = item["MERCNAME"].strip()
    return not any(excluded in merchant_name for excluded in EXCLUDED_MERCHANTS)
