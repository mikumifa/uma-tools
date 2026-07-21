import { h } from "preact";
import "./ProgressBar.css";

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  const value = Math.min(100, Math.max(0, progress));
  return (
    <div class="progressBarContainer">
      <div class="progressBarHeader">
        {label && <div class="progressBarLabel">{label}</div>}
        <div class="progressBarValue">{value.toFixed(0)}%</div>
      </div>
      <div class="progressBarTrack">
        <div
          class="progressBarFill"
          data-active={value > 0 && value < 100 ? "true" : "false"}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
