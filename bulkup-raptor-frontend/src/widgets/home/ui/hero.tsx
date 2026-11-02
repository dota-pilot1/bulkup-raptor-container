export function Hero() {
  return (
    <section className="relative mt-12 overflow-hidden rounded-2xl bg-[#dfeee6] px-6 py-7 sm:px-8 sm:py-8">
      <div className="relative z-10 max-w-xl pr-12 sm:pr-0">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-700">BUILD YOUR DAILY ROUTINE</p>
        <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-zinc-950 sm:text-2xl">좋은 루틴은 작은 선택에서 시작돼요.</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">내 몸에 필요한 제품만 골라 담고, 매일의 변화를 가볍게 시작해보세요.</p>
      </div>
      <div className="pointer-events-none absolute -bottom-4 -right-4 text-[6rem] opacity-50 sm:right-6 sm:text-[8rem]" aria-hidden="true">🌿</div>
    </section>
  );
}
