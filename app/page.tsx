import Link from "next/link";

const highlights = [
  {
    title: "Time-aware weather",
    body: "Conditions are matched to when you are expected to reach each part of the drive.",
  },
  {
    title: "Simple route summary",
    body: "See the overall risk, the rough spots, and a plain recommendation in one view.",
  },
  {
    title: "Built for winter trips",
    body: "Use it for quick planning without digging through multiple weather screens.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <section className="glass-panel rounded-[40px] px-6 py-10 sm:px-8 sm:py-12 lg:px-10">
          <div className="max-w-3xl space-y-6">
            <p className="eyebrow">Winter trip planning</p>
            <h1 className="display-type text-5xl leading-[0.92] text-white sm:text-6xl">
              Clearer decisions for snowy drives.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              SnowRoute checks weather risk along the route, not just at the start and finish.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/analyze-trip"
                className="inline-flex h-13 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ecfaff,#b8ebff_42%,#84d0f5)] px-6 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_40px_rgba(84,181,239,0.18)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105"
              >
                Analyze a trip
              </Link>
              <Link
                href="/about"
                className="inline-flex h-13 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-medium uppercase tracking-[0.2em] text-slate-100 transition hover:bg-white/[0.08]"
              >
                About
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="glass-panel rounded-[28px] p-6">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
