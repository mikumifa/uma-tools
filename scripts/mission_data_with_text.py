""" "
统计任务的情况
"""

import sqlite3

import pandas as pd

conn = sqlite3.connect("master.mdb")

mission_df = pd.read_sql(
    """
    SELECT 
        disp_order,
        item_id,
        start_date,
        end_date,
        id,
        item_num
    FROM mission_data
""",
    conn,
)

text_df = pd.read_sql("SELECT * FROM text_data", conn)

item_text_df = text_df[text_df["category"] == 23][["index", "text"]].rename(
    columns={"index": "item_id", "text": "item_text"}
)

mission_text_df = text_df[text_df["category"] == 67][["index", "text"]].rename(
    columns={"index": "id", "text": "mission_text"}
)

result = mission_df.merge(item_text_df, on="item_id", how="left").merge(
    mission_text_df, on="id", how="left"
)
result.to_csv("results/mission_with_text.csv", index=False, encoding="utf-8-sig")
print("导出完成 -> mission_with_text.csv")
