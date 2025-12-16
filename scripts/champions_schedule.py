import os
import sqlite3
from datetime import datetime

import pandas as pd


def ts_to_str(ts: int) -> str:
    """Convert epoch seconds to readable string."""
    try:
        if ts is None:
            return ""
        return datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except (OSError, OverflowError, ValueError, TypeError):
        return ""


def main() -> None:
    conn = sqlite3.connect("master.mdb")

    query = """
        SELECT
            cs.id AS champions_id,
            cs.start_date,
            cs.end_date,
            cs.notice_date,
            crc.round_id,
            crc.race_instance_id,
            crc.race_condition_id,
            ri.race_id,
            td.text AS race_name
        FROM champions_schedule cs
        LEFT JOIN champions_race_condition crc
            ON crc.champions_id = cs.id
        LEFT JOIN race_instance ri
            ON ri.id = crc.race_instance_id
        LEFT JOIN text_data td
            ON td.category = 33 AND td."index" = ri.race_id
        ORDER BY cs.start_date, cs.id, crc.round_id
    """
    df = pd.read_sql(query, conn)
    conn.close()

    # Same champions_id can appear per round; keep the first entry for each champions.
    df = df.sort_values(["start_date", "champions_id", "round_id"]).drop_duplicates(
        subset=["champions_id"], keep="first"
    )

    # Convert timestamps to readable text while keeping originals.
    df["start_time"] = df["start_date"].apply(ts_to_str)
    df["end_time"] = df["end_date"].apply(ts_to_str)
    df["notice_time"] = df["notice_date"].apply(ts_to_str)

    output_path = "results/champions_schedule.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"导出完成 -> {output_path}")


if __name__ == "__main__":
    main()
