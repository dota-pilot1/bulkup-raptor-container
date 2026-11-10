"use client";

import { useEffect, useState } from "react";

const clock = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

export function PaymentDeadline({ expiresAt }: { expiresAt?: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const remain = now === null ? null : end - now;
  return <p className="text-xs font-semibold text-amber-800">
    결제 마감 <time dateTime={expiresAt}>{clock.format(end)}</time>
    {remain !== null && remain <= 0 && " · 결제 시간이 지났습니다"}
    {remain !== null && remain > 0 && ` · ${remaining(remain)} 남음`}
  </p>;
}

function remaining(remain: number) {
  const minutes = Math.floor(remain / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}
