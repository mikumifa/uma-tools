#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$ROOT_DIR"

scripts=(
  "scripts/gacha_free_campaign.py"
  "scripts/exchange_data.py"
  "scripts/login_data.py"
  "scripts/mission_data_with_text.py"
  "scripts/story_event_stats.py"
  "scripts/transfer_data.py"
  "scripts/gacha_data.py"
  "scripts/champions_schedule.py"
  "scripts/legend_race.py"
  "scripts/campaign_data.py"
  "scripts/text_data_csv.py"
  "scripts/run_all_csv_jp.py"
)

if ! command -v uv >/dev/null 2>&1; then
  echo "[ERROR] uv is not installed or not in PATH." >&2
  exit 1
fi

for script in "${scripts[@]}"; do
  if [[ ! -f "$script" ]]; then
    echo "[ERROR] Script not found: ${script}" >&2
    exit 1
  fi

  echo "==> Running ${script}"
  uv run "${script}"
done

echo "All CSV exports completed."
