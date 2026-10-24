export function ConfigError({ issues }: { issues: readonly string[] }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="font-display text-3xl text-cream">Configuration needed</h1>
      <p className="mt-3 text-sm text-mist">The app cannot start until these environment variables are fixed.</p>
      <ul className="mt-5 space-y-2">
        {issues.map((issue) => (
          <li key={issue} className="rounded-2xl bg-aubergine-800 px-4 py-3 font-mono text-xs text-copper-300 ring-1 ring-white/5">
            {issue}
          </li>
        ))}
      </ul>
    </main>
  )
}
