import { Suspense } from "react";
import { BenefitBanner } from "@/widgets/home/ui/benefit-banner";
import { Hero } from "@/widgets/home/ui/hero";
import { ProductSection } from "@/widgets/home/ui/product-section";
import { Header } from "@/widgets/header/ui/header";

export default async function Home({ searchParams }: { searchParams: Promise<{ cart?: string }> }) {
  const { cart } = await searchParams;
  return (
    <>
      <Header initialCartOpen={cart === "open"} />
      <main id="top" className="mx-auto w-full max-w-7xl flex-1 px-6 py-6 sm:px-10 sm:py-8">
        <Suspense fallback={null}><ProductSection /></Suspense>
        <Hero />
        <BenefitBanner />
      </main>
      <footer className="mt-20 border-t border-zinc-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="font-bold tracking-wider text-zinc-900">BULKUP.</span>
          <span>건강한 루틴을 위한 큐레이션 쇼핑몰</span>
          <span>© 2026 Bulkup Raptor</span>
        </div>
      </footer>
    </>
  );
}
