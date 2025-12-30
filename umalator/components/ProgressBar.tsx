import { h } from "preact";
import "./ProgressBar.css";

interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div class="progressBarContainer">
      {label && <div class="progressBarLabel">{label}</div>}
      <div class="progressBarTrack">
        <div
          class="progressBarFill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <div class="progressBarValue">{progress.toFixed(0)}%</div>
    </div>
  );
}
