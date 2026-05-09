import csv
import os
import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path


SCRIPT_FILES = [
    "scripts/gacha_free_campaign.py",
    "scripts/exchange_data.py",
    "scripts/login_data.py",
    "scripts/mission_data_with_text.py",
    "scripts/story_event_stats.py",
    "scripts/transfer_data.py",
    "scripts/gacha_data.py",
    "scripts/champions_schedule.py",
    "scripts/legend_race.py",
    "scripts/campaign_data.py",
    "scripts/factor_research_data.py",
]


def build_merged_master_db(jp_db: Path, master_db: Path, out_db: Path) -> None:
    shutil.copy2(jp_db, out_db)
    conn = sqlite3.connect(out_db)
    cur = conn.cursor()
    cur.execute("ATTACH DATABASE ? AS master_db", (str(master_db),))
    cur.execute(
        """
        UPDATE text_data
        SET text = (
            SELECT m.text
            FROM master_db.text_data m
            WHERE m.category = text_data.category
              AND m.[index] = text_data.[index]
            ORDER BY m.id
            LIMIT 1
        )
        WHERE EXISTS (
            SELECT 1
            FROM master_db.text_data m
            WHERE m.category = text_data.category
              AND m.[index] = text_data.[index]
        )
        """
    )
    conn.commit()
    conn.close()


def export_text_data_csv(db_path: Path, output_csv: Path) -> None:
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


def run_script(project_root: Path, working_dir: Path, script_rel_path: str) -> None:
    script_path = project_root / script_rel_path
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    subprocess.run(
        ["uv", "run", "--project", str(project_root), str(script_path)],
        cwd=working_dir,
        env=env,
        check=True,
    )


def copy_results(tmp_results_dir: Path, jp_results_dir: Path) -> None:
    jp_results_dir.mkdir(parents=True, exist_ok=True)
    for src in tmp_results_dir.glob("*"):
        if src.is_file():
            shutil.copy2(src, jp_results_dir / src.name)


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    master_db = project_root / "master.mdb"
    jp_db = project_root / "jp-master.mdb"
    jp_results_dir = project_root / "results" / "jp"

    if not master_db.exists():
        raise FileNotFoundError(f"Master DB not found: {master_db}")
    if not jp_db.exists():
        raise FileNotFoundError(f"JP DB not found: {jp_db}")

    with tempfile.TemporaryDirectory(prefix="uma_jp_export_") as tmp:
        tmp_dir = Path(tmp)
        tmp_master = tmp_dir / "master.mdb"
        tmp_results = tmp_dir / "results"
        tmp_results.mkdir(parents=True, exist_ok=True)

        build_merged_master_db(jp_db, master_db, tmp_master)
        export_text_data_csv(tmp_master, tmp_results / "text_data.csv")

        for script_file in SCRIPT_FILES:
            print(f"==> Running {script_file} (JP merged text mode)")
            run_script(project_root, tmp_dir, script_file)

        copy_results(tmp_results, jp_results_dir)

    print(f"All JP exports completed -> {jp_results_dir}")


if __name__ == "__main__":
    main()
