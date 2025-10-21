import argparse
import csv
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def timestamp_to_str(ts):
    if ts is None:
        return ""
    try:
        # 如果是整数或字符串数字
        ts_int = int(ts)
        return datetime.utcfromtimestamp(ts_int).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts)


def get_transfer_event_stats(db_path: Path, output_csv: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ================================
    # 1. 获取 transfer_event_reward + detail 数据
    # ================================
    cur.execute("""
        SELECT r.transfer_reward_id, r.transfer_detail_id, r.item_category, r.item_id, r.item_num,
               d.transfer_event_id, d.start_date, d.end_date
        FROM transfer_event_reward r
        LEFT JOIN transfer_event_detail d
        ON r.transfer_detail_id = d.transfer_detail_id
    """)
    rewards = cur.fetchall()

    # ================================
    # 2. 获取物品名称，按类别分开
    # ================================
    cur.execute("SELECT [index], text FROM text_data WHERE category = 23")
    item_texts_23 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 75")
    item_texts_75 = {row["index"]: row["text"] for row in cur.fetchall()}

    # ================================
    # 3. 统计每个兑换活动的奖励
    # ================================
    stats = defaultdict(
        lambda: defaultdict(
            lambda: {"count": 0, "total_num": 0, "start_date": None, "end_date": None}
        )
    )

    for row in rewards:
        event_id = row["transfer_event_id"]
        if event_id is None:
            continue
        item_id = row["item_id"]
        item_category = row["item_category"]
        item_num = row["item_num"] or 0

        stats[event_id][(item_id, item_category)]["count"] += 1
        stats[event_id][(item_id, item_category)]["total_num"] += item_num
        stats[event_id][(item_id, item_category)]["start_date"] = row["start_date"]
        stats[event_id][(item_id, item_category)]["end_date"] = row["end_date"]

    # ================================
    # 4. 写入 CSV
    # ================================
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        writer.writerow(
            [
                "Transfer Event ID",
                "Item ID",
                "Item Name",
                "Item Category",
                "Count",
                "Total Num",
                "Start Date",
                "End Date",
            ]
        )

        table = []

        for event_id, items in stats.items():
            for (item_id, item_category), data in items.items():
                if item_id == 0:
                    continue
                item_name = (
                    item_texts_75.get(item_id)
                    if item_category == 51
                    else item_texts_23.get(item_id, f"Item_{item_id}")
                )
                start_date_str = timestamp_to_str(data["start_date"])
                end_date_str = timestamp_to_str(data["end_date"])
                writer.writerow(
                    [
                        event_id,
                        item_id,
                        item_name,
                        item_category,
                        data["count"],
                        data["total_num"],
                        start_date_str,
                        end_date_str,
                    ]
                )
                table.append(
                    [
                        event_id,
                        item_id,
                        item_name,
                        item_category,
                        data["count"],
                        data["total_num"],
                        start_date_str,
                        end_date_str,
                    ]
                )
    print(f"\nCSV saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="统计每个兑换活动的物品奖励")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("master.mdb"),
        help="SQLite 数据库文件路径（默认当前目录 master.mdb）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/transfer_event_stats.csv"),
        help="输出 CSV 文件路径",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"数据库文件不存在: {args.db}")
        return

    get_transfer_event_stats(args.db, args.output)


if __name__ == "__main__":
    main()
