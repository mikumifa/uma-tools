import csv
import os
import sqlite3
from datetime import datetime


def ts_to_str(ts: int) -> str:
    try:
        return "" if ts is None else datetime.fromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def main() -> None:
    conn = sqlite3.connect("master.mdb")
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            cd.campaign_id,
            cd.start_time,
            cd.end_time,
            td.text AS campaign_name
        FROM campaign_data cd
        LEFT JOIN text_data td
            ON td.category = 187 AND td.[index] = cd.campaign_id
        ORDER BY cd.start_time, cd.campaign_id
        """
    )
    rows = cur.fetchall()
    conn.close()

    output_path = "results/campaign_data.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["campaign_id", "campaign_name", "start_time", "end_time", "start_time_str", "end_time_str"]
        )
        for campaign_id, start_time, end_time, name in rows:
            writer.writerow(
                [
                    campaign_id,
                    name or f"Campaign_{campaign_id}",
                    start_time,
                    end_time,
                    ts_to_str(start_time),
                    ts_to_str(end_time),
                ]
            )

    print(f"导出完成 -> {output_path}")


if __name__ == "__main__":
    main()
