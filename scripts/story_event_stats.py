import argparse
import csv
import sqlite3
from collections import defaultdict
from pathlib import Path

from tabulate import tabulate


def get_story_event_stats(db_path: Path, output_csv: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 1. 获取 story_event_point_reward 数据
    cur.execute("""
        SELECT id, story_event_id, item_category, item_id, item_num, point
        FROM story_event_point_reward
    """)
    rewards = cur.fetchall()

    # 2. 获取 story_event_mission 的奖励
    cur.execute("""
        SELECT id, story_event_id, item_category, item_id, item_num
        FROM story_event_mission
        WHERE item_id IS NOT NULL AND item_num IS NOT NULL
    """)
    mission_rewards = cur.fetchall()

    # 合并两个奖励列表
    all_rewards = list(rewards) + list(mission_rewards)

    # 3. 获取活动名称
    cur.execute("SELECT [index], text FROM text_data WHERE category = 189")
    event_texts = {row["index"]: row["text"] for row in cur.fetchall()}

    # 4. 获取物品名称，按类别分开
    cur.execute("SELECT [index], text FROM text_data WHERE category = 23")
    item_texts_23 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 75")
    item_texts_75 = {row["index"]: row["text"] for row in cur.fetchall()}

    # 5. 统计每个活动下的物品数量和总数
    stats = defaultdict(lambda: defaultdict(lambda: {"count": 0, "total_num": 0}))
    for row in all_rewards:
        event_id = row["story_event_id"]
        item_id = row["item_id"]
        item_num = row["item_num"] or 0
        item_category = row["item_category"]

        stats[event_id][(item_id, item_category)]["count"] += 1
        stats[event_id][(item_id, item_category)]["total_num"] += item_num

    # 6. 写入 CSV 并打印表格
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Event Name", "Item Name", "Total Num"])
        table = []
        for event_id, items in stats.items():
            event_name = event_texts.get(event_id, f"Event_{event_id}")
            for (item_id, item_category), data in items.items():
                if item_category == 51:
                    item_name = item_texts_75.get(item_id, f"Item_{item_id}")
                else:
                    item_name = item_texts_23.get(item_id, f"Item_{item_id}")
                writer.writerow([event_name, item_name, data["total_num"]])
                table.append(
                    [
                        event_id,
                        event_name,
                        item_id,
                        item_name,
                        item_category,
                        data["count"],
                        data["total_num"],
                    ]
                )

    print(
        tabulate(
            table,
            headers=[
                "Event ID",
                "Event Name",
                "Item ID",
                "Item Name",
                "Item Category",
                "Count",
                "Total Num",
            ],
            tablefmt="grid",
        )
    )
    print(f"\nCSV saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="统计每个活动的物品数量和总数")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("master.mdb"),
        help="SQLite 数据库文件路径（默认当前目录 master.mdb）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/story_event_stats.csv"),
        help="输出 CSV 文件路径",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"数据库文件不存在: {args.db}")
        return

    get_story_event_stats(args.db, args.output)


if __name__ == "__main__":
    main()
