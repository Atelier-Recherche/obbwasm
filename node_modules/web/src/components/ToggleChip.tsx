export function ToggleChip({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className={`toggle-chip ${enabled ? "on" : "off"}`}
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <span className="toggle-knob" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
