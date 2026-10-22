/** 삭제 성공 후 실제 행을 조각으로 나누어 짧게 흩어 보낸다. */
export async function crumbleMenu(title: string, id: number): Promise<void> {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const row = Array.from(document.querySelectorAll<HTMLElement>("[data-playbook-menu]"))
    .find((element) => element.dataset.playbookMenu === `${title}:${id}`);
  if (!row || typeof row.animate !== "function") return;
  const rect = row.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const overlay = document.createElement("div");
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  Object.assign(overlay.style, {
    position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`,
    pointerEvents: "none", zIndex: "200",
  });
  const animations: Animation[] = [];
  const originalVisibility = row.style.visibility;
  try {
    // 각각의 조각에는 실제 행의 텍스트·배경을 같은 위치에 잘라 넣는다.
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = document.createElement("div");
        Object.assign(piece.style, {
          position: "absolute", overflow: "hidden",
          left: `${x * rect.width / 8}px`, top: `${y * rect.height / 3}px`,
          width: `${rect.width / 8}px`, height: `${rect.height / 3}px`,
        });
        const fragment = row.cloneNode(true) as HTMLElement;
        fragment.removeAttribute("data-playbook-menu");
        fragment.removeAttribute("id");
        fragment.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
        Object.assign(fragment.style, {
          position: "absolute", margin: "0", boxSizing: "border-box",
          width: `${rect.width}px`, height: `${rect.height}px`,
          left: `${-x * rect.width / 8}px`, top: `${-y * rect.height / 3}px`,
        });
        piece.append(fragment);
        overlay.append(piece);
        const spread = (x - 3.5) * (6 + y * 2);
        animations.push(piece.animate([
          { opacity: 1, transform: "translate(0, 0) rotate(0deg) scale(1)" },
          { opacity: 0.8, offset: 0.3, transform: `translate(${spread * 0.4}px, -8px) rotate(${spread / 2}deg) scale(.9)` },
          { opacity: 0, transform: `translate(${spread}px, ${24 + y * 14}px) rotate(${spread * 2}deg) scale(.25)` },
        ], { duration: 360, delay: x * 10 + y * 8, easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" }));
      }
    }
    document.body.append(overlay);
    row.style.visibility = "hidden";
    await Promise.allSettled(animations.map((animation) => animation.finished));
  } catch {
    // 시각 효과를 지원하지 않아도 서버에서 완료된 삭제는 그대로 반영한다.
  } finally {
    animations.forEach((animation) => animation.cancel());
    overlay.remove();
    row.style.visibility = originalVisibility;
  }
}
