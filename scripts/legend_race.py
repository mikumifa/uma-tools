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
            lr.id,
            lr.image_id,
            lr.notice_date,
            lr.start_date,
            lr.end_date,
            td.text AS legend_name
        FROM legend_race lr
        LEFT JOIN text_data td
            ON td.category = 4 AND td.[index] = lr.image_id
        ORDER BY lr.start_date, lr.id
        """
    )
    rows = cur.fetchall()
    conn.close()

    output_path = "results/legend_race.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    import csv

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["id", "image_id", "legend_name", "notice_time", "start_time", "end_time"]
        )
        for row in rows:
            lr_id, image_id, notice, start, end, name = row
            writer.writerow(
                [
                    lr_id,
                    image_id,
                    name or f"Legend_{image_id}",
                    ts_to_str(notice),
                    ts_to_str(start),
                    ts_to_str(end),
                ]
            )
    print(f"导出完成 -> {output_path}")


if __name__ == "__main__":
    main()
