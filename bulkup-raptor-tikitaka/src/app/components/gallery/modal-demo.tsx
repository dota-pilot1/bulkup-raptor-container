/* eslint-disable react-hooks/set-state-in-effect -- controlled demo state mirrors its external preview prop. */
import { useEffect, useState } from 'react';
import { Button } from './button';
import { Modal } from './modal';
import './modal.css';

/**
 * 갤러리 전용 시연 래퍼.
 * Modal이 부모 기준 absolute로 깔리므로 무대에 position:relative를 준다.
 */
export function ModalDemo({
  kind = 'modal',
  side = 'right',
  open: openProp = true,
  title = 'LOT 삭제',
  description = '되돌릴 수 없습니다.',
}: {
  kind?: 'modal' | 'drawer';
  side?: 'left' | 'right';
  open?: boolean;
  title?: string;
  description?: string;
}) {
  const [open, setOpen] = useState(openProp);

  // 컨트롤에서 open을 바꾸면 따라가되, 그 뒤에는 버튼으로 다시 열고 닫을 수 있다.
  useEffect(() => setOpen(openProp), [openProp]);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 300, background: '#f8fafc', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: 20 }}>
        <Button variant="danger" onClick={() => setOpen(true)}>LOT 삭제</Button>
      </div>
      <Modal
        open={open}
        kind={kind}
        side={side}
        title={title}
        description={description}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>취소</Button>
            <Button variant="danger" size="sm" onClick={() => setOpen(false)}>삭제</Button>
          </>
        }
      >
        LOT-24084를 삭제하면 연결된 공정 이력도 함께 사라집니다. 계속할까요?
      </Modal>
    </div>
  );
}
