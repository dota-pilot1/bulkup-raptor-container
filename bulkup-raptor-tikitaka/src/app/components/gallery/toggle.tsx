import './toggle.css';

type ToggleKind = 'checkbox' | 'radio' | 'switch';

type ToggleProps = {
  kind?: ToggleKind;
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
};

export function Toggle({ kind = 'checkbox', label, checked, disabled = false, onChange }: ToggleProps) {
  const handle = (next: boolean) => onChange?.(next);

  if (kind === 'switch') {
    return (
      <label className={`toggle toggle-switch ${disabled ? 'toggle-disabled' : ''}`}>
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => handle(event.target.checked)}
        />
        <span className="toggle-track"><span className="toggle-knob" /></span>
        <span className="toggle-text">{label}</span>
      </label>
    );
  }

  return (
    <label className={`toggle ${disabled ? 'toggle-disabled' : ''}`}>
      <input
        type={kind}
        className="toggle-box"
        checked={checked}
        disabled={disabled}
        onChange={(event) => handle(event.target.checked)}
      />
      <span className="toggle-text">{label}</span>
    </label>
  );
}

