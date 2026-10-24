import { ExternalLink } from 'lucide-react'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { FeedTabs } from '@/components/FeedTabs'
import { env } from '@/env'
import { appChain } from '@/lib/chain'
import { shortAddress } from '@/lib/format'

export default function App() {
  const explorer = appChain.blockExplorers?.default.url
  return (
    <div className="min-h-dvh">
      <Header />
      <main className="px-5 pb-24">
        <Hero />
        <FeedTabs />
        <footer className="mx-auto mt-16 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-xs text-mist">
          <span>{appChain.name}</span>
          {explorer ? (
            <a
              href={`${explorer}/address/${env.contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono transition hover:text-cream"
            >
              {shortAddress(env.contractAddress)} <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="font-mono">{shortAddress(env.contractAddress)}</span>
          )}
        </footer>
      </main>
    </div>
  )
}
