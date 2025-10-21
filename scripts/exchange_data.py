import argparse
import csv
import sqlite3
from datetime import datetime
from pathlib import Path


def timestamp_to_str(ts):
    """将 Unix 时间戳转换为可读时间字符串"""
    if ts is None:
        return ""
    try:
        return datetime.utcfromtimestamp(int(ts)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(ts)


def export_item_exchange(db_path: Path, output_csv: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ================================
    # 1. 读取 item_exchange 表
    # ================================
    cur.execute("SELECT * FROM item_exchange")
    exchanges = cur.fetchall()

    # ================================
    # 2. 获取物品名称
    # ================================
    cur.execute("SELECT [index], text FROM text_data WHERE category = 23")
    item_texts_23 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 75")
    item_texts_75 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 113")
    item_texts_113 = {row["index"]: row["text"] for row in cur.fetchall()}

    cur.execute("SELECT [index], text FROM text_data WHERE category = 4")
    item_texts_4 = {row["index"]: row["text"] for row in cur.fetchall()}

    # ================================
    # 3. 写 CSV 并打印表格
    # ================================
    table = []
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "Exchange ID",
                "Top ID",
                "Disp Order",
                "Pay Item Name",
                "Pay Item Num",
                "Change Item Name",
                "Change Item Num",
                "Start Date",
                "End Date",
            ]
        )

        for row in exchanges:
            pay_id = row["pay_item_id"]
            pay_cat = row["pay_item_category"]
            pay_num = row["pay_item_num"]
            if pay_cat == 51:
                pay_name = item_texts_75.get(pay_id, f"Item_{pay_id}")
            elif pay_cat == 102:
                pay_name = item_texts_113.get(pay_id, f"Item_{pay_id}")
            elif pay_cat == 50:
                pay_name = item_texts_4.get(pay_id, f"Item_{pay_id}")
            else:
                pay_name = item_texts_23.get(pay_id, f"Item_{pay_id}")

            change_id = row["change_item_id"]
            change_cat = row["change_item_category"]
            change_num = row["change_item_num"]
            if change_cat == 51:
                change_name = item_texts_75.get(change_id, f"Item_{change_id}")
            elif change_cat == 102:
                change_name = item_texts_113.get(change_id, f"Item_{change_id}")
            elif change_cat == 50:
                change_name = item_texts_4.get(change_id, f"Item_{change_id}")
            else:
                change_name = item_texts_23.get(change_id, f"Item_{change_id}")

            start_date = timestamp_to_str(row["start_date"])
            end_date = timestamp_to_str(row["end_date"])

            writer.writerow(
                [
                    row["id"],
                    row["item_exchange_top_id"],
                    row["disp_order"],
                    pay_name,
                    pay_num,
                    change_name,
                    change_num,
                    start_date,
                    end_date,
                ]
            )

            table.append(
                [
                    row["id"],
                    row["item_exchange_top_id"],
                    row["disp_order"],
                    pay_name,
                    pay_num,
                    change_name,
                    change_num,
                    start_date,
                    end_date,
                ]
            )

    print(f"\nCSV saved to {output_csv}")


def main():
    parser = argparse.ArgumentParser(description="导出物品兑换信息")
    parser.add_argument(
        "--db", type=Path, default=Path("master.mdb"), help="SQLite 数据库文件路径"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("results/item_exchange.csv"),
        help="输出 CSV 文件路径",
    )
    args = parser.parse_args()

    if not args.db.exists():
        print(f"数据库文件不存在: {args.db}")
        return

    export_item_exchange(args.db, args.output)


if __name__ == "__main__":
    main()
