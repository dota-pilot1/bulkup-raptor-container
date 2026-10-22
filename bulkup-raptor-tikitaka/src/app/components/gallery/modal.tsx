import type { ReactNode } from 'react';
import './modal.css';

type SheetKind = 'modal' | 'drawer';
type DrawerSide = 'left' | 'right';

type ModalProps = {
  open: boolean;
  kind?: SheetKind;
  /** drawer일 때만 쓰인다. */
  side?: DrawerSide;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
};

/**
 * 포털을 쓰지 않는다. 부모 안에 absolute로 깔리므로 미리보기 안에 가둘 수 있고,
 * 화면 전체를 덮어야 하면 사용하는 쪽에서 fixed 컨테이너에 넣거나 createPortal로 감싼다.
 */
export function Modal({
  open,
  kind = 'modal',
  side = 'right',
  title,
  description,
  children,
  footer,
  onClose,
}: ModalProps) {
  if (!open) return null;

  const place = kind === 'modal' ? 'overlay-center' : side === 'left' ? 'overlay-left' : 'overlay-right';

  return (
    <div className={`overlay ${place}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`sheet sheet-${kind}`}>
        <div className="sheet-head">
          <div className="sheet-heads">
            <h2 className="sheet-title">{title}</h2>
            {description ? <p className="sheet-desc">{description}</p> : null}
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

