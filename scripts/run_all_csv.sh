#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$ROOT_DIR"

scripts=(
  "scripts/dynamic_data.py"
  "scripts/exchange_data.py"
  "scripts/login_data.py"
  "scripts/mission_data_with_text.py"
  "scripts/story_event_stats.py"
  "scripts/transfer_data.py"
  "scripts/gacha_data.py"
)

for script in "${scripts[@]}"; do
  echo "==> Running ${script}"
  uv run "${script}"
done

echo "All CSV exports completed."
