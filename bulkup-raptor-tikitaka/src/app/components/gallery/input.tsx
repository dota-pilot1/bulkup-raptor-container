import type { InputHTMLAttributes } from 'react';
import './input.css';

type InputSize = 'sm' | 'md' | 'lg';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  size?: InputSize;
  invalid?: boolean;
  /** invalid일 때만 보여주는 오류 문구. */
  error?: string;
  hint?: string;
};

export function Input({
  label,
  size = 'md',
  invalid = false,
  error,
  hint,
  className = '',
  ...props
}: InputProps) {
  return (
    <label className={`field field-${size} ${invalid ? 'field-invalid' : ''} ${className}`}>
      {label ? <span className="field-label">{label}</span> : null}
      <input className="field-input" aria-invalid={invalid || undefined} {...props} />
      {invalid && error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

