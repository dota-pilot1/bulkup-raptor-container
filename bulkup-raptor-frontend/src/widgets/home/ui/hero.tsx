export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#dfeee6] px-7 py-12 sm:px-12 sm:py-16">
      <div className="relative z-10 max-w-xl">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-700">BUILD YOUR DAILY ROUTINE</p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-tight text-zinc-950 sm:text-6xl">좋은 루틴은<br />작은 선택에서 시작돼요.</h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-zinc-600 sm:text-base">내 몸에 필요한 제품만 골라 담고, 매일의 변화를 가볍게 시작해보세요.</p>
        <a href="#products" className="mt-8 inline-flex rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">추천 상품 보기 →</a>
      </div>
      <div className="pointer-events-none absolute -bottom-12 -right-4 text-[12rem] opacity-80 sm:right-12 sm:text-[16rem]" aria-hidden="true">🌿</div>
    </section>
  );
}
