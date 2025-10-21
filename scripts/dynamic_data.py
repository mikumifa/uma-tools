import sqlite3
import csv

def diff_sqlite(old_db_path, new_db_path, added_db_path, removed_db_path, added_csv="added.csv", removed_csv="removed.csv"):
    old_conn = sqlite3.connect(old_db_path)
    new_conn = sqlite3.connect(new_db_path)
    old_cur = old_conn.cursor()
    new_cur = new_conn.cursor()

    added_conn = sqlite3.connect(added_db_path)
    removed_conn = sqlite3.connect(removed_db_path)

    # 统计每个表的新增/减少行数
    added_counts = []
    removed_counts = []

    # 获取所有用户表，排除 SQLite 内部表
    old_tables = [t[0] for t in old_cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    ).fetchall()]

    for table in old_tables:
        # 获取创建表语句
        create_sql = old_cur.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'").fetchone()[0]

        # 删除已存在表并重新创建
        added_conn.execute(f'DROP TABLE IF EXISTS "{table}"')
        removed_conn.execute(f'DROP TABLE IF EXISTS "{table}"')
        added_conn.execute(create_sql)
        removed_conn.execute(create_sql)

        # 获取公共字段
        old_cols = [col[1] for col in old_cur.execute(f'PRAGMA table_info("{table}")').fetchall()]
        new_cols = [col[1] for col in new_cur.execute(f'PRAGMA table_info("{table}")').fetchall()]
        common_cols = list(set(old_cols) & set(new_cols))
        if not common_cols:
            continue  # 没有公共字段跳过
        common_cols_quoted = [f'"{col}"' for col in common_cols]
        common_cols_str = ", ".join(common_cols_quoted)

        # 获取数据
        old_rows = set(old_cur.execute(f'SELECT {common_cols_str} FROM "{table}"').fetchall())
        new_rows = set(new_cur.execute(f'SELECT {common_cols_str} FROM "{table}"').fetchall())

        # 计算新增/减少行
        added_rows = new_rows - old_rows
        removed_rows = old_rows - new_rows

        # 插入数据
        placeholders = ",".join("?" * len(common_cols))
        if added_rows:
            added_conn.executemany(f'INSERT INTO "{table}" ({common_cols_str}) VALUES ({placeholders})', list(added_rows))
        if removed_rows:
            removed_conn.executemany(f'INSERT INTO "{table}" ({common_cols_str}) VALUES ({placeholders})', list(removed_rows))

        # 记录数量
        added_counts.append((table, len(added_rows)))
        removed_counts.append((table, len(removed_rows)))

    # 提交并关闭数据库
    added_conn.commit()
    removed_conn.commit()
    old_conn.close()
    new_conn.close()
    added_conn.close()
    removed_conn.close()

    # 写 CSV
    with open(added_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["table", "added_rows"])
        writer.writerows([row for row in added_counts if row[1] > 0])

    with open(removed_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["table", "removed_rows"])
        writer.writerows([row for row in removed_counts if row[1] > 0])


# 使用示例
diff_sqlite(
    "history/master.mdb", 
    "master.mdb", 
    "results/added.sqlite", 
    "results/removed.sqlite",
    added_csv="results/added.csv",
    removed_csv="results/removed.csv"
)
