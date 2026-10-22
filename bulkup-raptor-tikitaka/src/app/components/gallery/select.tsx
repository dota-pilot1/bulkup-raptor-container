import type { SelectHTMLAttributes } from 'react';
import './select.css';

type SelectSize = 'sm' | 'md' | 'lg';

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> & {
  label?: string;
  size?: SelectSize;
  options: string[];
  placeholder?: string;
};

export function Select({ label, size = 'md', options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <label className={`picker picker-${size} ${className}`}>
      {label ? <span className="picker-label">{label}</span> : null}
      <select className="picker-control" defaultValue={placeholder ? '' : undefined} {...props}>
        {placeholder ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

