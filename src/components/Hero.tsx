import { CoinSlot } from './CoinSlot'

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 pb-6 pt-10 text-center sm:pt-16">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-400">Pay per question · Escrowed on Arc</p>
      <h1 className="mt-5 text-balance font-display text-5xl font-medium leading-[1.02] tracking-[-0.03em] text-cream sm:text-7xl">
        One penny. <span className="italic text-copper-400">One answer.</span>
      </h1>
      <p className="mt-5 max-w-md text-pretty text-[15px] leading-relaxed text-mist">
        Your payment waits in escrow until the Oracle commits to an answer. If it never does, you take it back.
      </p>
      <div className="mt-10 w-full">
        <CoinSlot />
      </div>
    </section>
  )
}
