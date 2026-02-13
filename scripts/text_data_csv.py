import argparse
import csv
import sqlite3
from pathlib import Path


def export_master_text_data(db_path: Path, output_csv: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, category, [index], text
        FROM text_data
        ORDER BY category, [index], id
        """
    )
    rows = cur.fetchall()
    conn.close()

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "category", "index", "text"])
        for row in rows:
            writer.writerow([row["id"], row["category"], row["index"], row["text"]])

    print(f"CSV saved to {output_csv}")


def export_jp_text_data_with_master_text(jp_db_path: Path, master_db_path: Path, output_csv: Path) -> None:
    conn = sqlite3.connect(jp_db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("ATTACH DATABASE ? AS master_db", (str(master_db_path),))

    cur.execute(
        """
        SELECT
            jp.id,
            jp.category,
            jp.[index],
            COALESCE(m.text, jp.text) AS text
        FROM text_data jp
        LEFT JOIN master_db.text_data m
            ON m.category = jp.category
            AND m.[index] = jp.[index]
        ORDER BY jp.category, jp.[index], jp.id
        """
    )
    rows = cur.fetchall()
    conn.close()

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(output_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "category", "index", "text"])
        for row in rows:
            writer.writerow([row["id"], row["category"], row["index"], row["text"]])

    print(f"CSV saved to {output_csv}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export text_data from master.mdb and jp-master.mdb to CSV."
    )
    parser.add_argument("--master-db", type=Path, default=Path("master.mdb"))
    parser.add_argument("--jp-db", type=Path, default=Path("jp-master.mdb"))
    parser.add_argument(
        "--master-output",
        type=Path,
        default=Path("results/text_data.csv"),
    )
    parser.add_argument(
        "--jp-output",
        type=Path,
        default=Path("results/jp/text_data.csv"),
    )
    args = parser.parse_args()

    if not args.master_db.exists():
        raise FileNotFoundError(f"Master DB not found: {args.master_db}")
    if not args.jp_db.exists():
        raise FileNotFoundError(f"JP DB not found: {args.jp_db}")

    export_master_text_data(args.master_db, args.master_output)
    export_jp_text_data_with_master_text(args.jp_db, args.master_db, args.jp_output)


if __name__ == "__main__":
    main()
