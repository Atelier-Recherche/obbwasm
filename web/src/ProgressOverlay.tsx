type Props = {
  phase: string | null;
  ratio?: number;
};

export function ProgressOverlay({ phase, ratio }: Props) {
  if (!phase) return null;
  const determinate = typeof ratio === "number" && ratio >= 0 && ratio <= 1;
  return (
    <div className="progress-overlay" role="status" aria-live="polite">
      <div className="progress-overlay-inner">
        <p className="progress-phase">{phase}</p>
        <div
          className={`progress-bar-track ${determinate ? "determinate" : "indeterminate"}`}
          aria-valuemin={determinate ? 0 : undefined}
          aria-valuemax={determinate ? 100 : undefined}
          aria-valuenow={determinate ? Math.round(ratio * 100) : undefined}
        >
          {determinate ? (
            <div className="progress-bar-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          ) : (
            <div className="progress-bar-indeterminate" />
          )}
        </div>
      </div>
    </div>
  );
}
