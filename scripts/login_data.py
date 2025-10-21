import argparse
import csv
import sqlite3
from pathlib import Path

from tabulate import tabulate


def get_login_bonus_stats(db_path: Path, output_csv: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ================================
    # 1. 读取 login_bonus_data
    # ================================
    cur.execute("""
        SELECT id, type, count_num, disp_order, stamp_id, start_date, end_date
        FROM login_bonus_data
    """)
    bonus_data = {row["id"]: row for row in cur.fetchall()}

    # ================================
    # 2. 读取 login_bonus_detail
    # ================================
    cur.execute("SELECT * FROM login_bonus_detail")
    bonus_details = cur.fetchall()

    # ================================
    # 3. 获取物品名称
    # ================================
    cur.execute("SELECT [index], text FROM text_data WHERE category = 23")
    item_texts_23 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 75")
    item_texts_75 = {row["index"]: row["text"] for row in cur.fetchall()}

    # ================================
    # 4. 整合奖励并写入 CSV
    # ================================
    table = []
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "Item Name",
                "Item Num",
                "Start Date",
                "End Date",
            ]
        )

        for detail in bonus_details:
            bonus_id = detail["login_bonus_id"]
            bonus = bonus_data.get(bonus_id)
            if not bonus:
                continue

            start_date = bonus["start_date"]
            end_date = bonus["end_date"]

            # 第1个奖励列（无后缀）
            items = [
                ("item_category", "item_id", "item_num"),
                ("item_category_2", "item_id_2", "item_num_2"),
                ("item_category_3", "item_id_3", "item_num_3"),
                ("item_category_4", "item_id_4", "item_num_4"),
                ("item_category_5", "item_id_5", "item_num_5"),
            ]

            for cat_key, id_key, num_key in items:
                item_category = detail[cat_key]
                item_id = detail[id_key]
                item_num = detail[num_key]
                if item_id is None or item_num is None:
                    continue
                if item_id == 0:
                    continue
                item_name = (
                    item_texts_75.get(item_id)
                    if item_category == 51
                    else item_texts_23.get(item_id, f"Item_{item_id}")
                )

                writer.writerow(
                    [
                        item_name,
                        item_num,
                        start_date,
                        end_date,
                    ]
                )
                table.append(
                    [
                        item_name,
                        item_num,
                        start_date,
                        end_date,
                    ]
                )

    # ================================
    # 5. 打印表格
    # ================================
    print(
        tabulate(
            table,
            headers=[
                "Item Name",
                "Item Num",
                "Start Date",
                "End Date",
            ],
            tablefmt="grid",
        )
    )
    print(f"\nCSV saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="统计登录奖励（Login Bonus）")
    parser.add_argument(
        "--db",
        type=Path,
        default=Path("master.mdb"),
        help="SQLite 数据库文件路径（默认 master.mdb）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/login_bonus_stats.csv"),
        help="输出 CSV 文件路径",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"数据库文件不存在: {args.db}")
        return

    get_login_bonus_stats(args.db, args.output)


if __name__ == "__main__":
    main()
