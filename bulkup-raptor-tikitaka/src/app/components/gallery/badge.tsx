import type { ReactNode } from 'react';
import './badge.css';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type BadgeSize = 'sm' | 'md';

type BadgeProps = {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** 상태 표시용 점을 앞에 붙인다. */
  dot?: boolean;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', size = 'md', dot = false, children }: BadgeProps) {
  return (
    <span className={`badge badge-${tone} badge-${size}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

