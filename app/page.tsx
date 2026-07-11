import Link from "next/link";

import { HomeTripLauncher } from "@/components/home-trip-launcher";

const valuePoints = [
  "Forecasts matched to arrival time",
  "Hazards explained in plain language",
  "No account required",
];

const steps = [
  ["Choose the route", "Start with each city, then add exact places only when useful."],
  ["Match the conditions", "Forecasts are aligned to when you reach each part of the drive."],
  ["Review the decision", "See whether to go, delay, hold, or avoid—and why."],
] as const;

export default function Home() {
  return (
    <main>
      <section className="border-b border-[#d9ddd6] bg-[#f8f7f3] py-8 sm:py-12 lg:py-16">
        <div className="page-container grid gap-10 lg:grid-cols-[minmax(0,0.76fr)_minmax(34rem,1.24fr)] lg:items-start lg:gap-14">
          <div className="max-w-xl lg:sticky lg:top-28">
            <p className="eyebrow">Route-specific weather guidance</p>
            <h1 className="display-type mt-4 text-[2.7rem] leading-[0.98] text-[#202927] sm:text-6xl lg:text-[4.25rem]">
              Know when the drive becomes risky.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-[#50605b]">
              SnowRoute checks the conditions you are likely to meet along the route and
              recommends whether to go, delay, hold, or avoid.
            </p>

            <ul className="mt-8 divide-y divide-[#d9ddd6] border-y border-[#d9ddd6] text-sm font-semibold text-[#384641]">
              {valuePoints.map((point) => (
                <li key={point} className="flex items-center gap-3 py-3.5">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#176c68]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <HomeTripLauncher />
        </div>
      </section>

      <section className="page-container py-14 sm:py-20" aria-labelledby="result-preview-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center">
          <div className="reading-width">
            <p className="eyebrow">A decision, not a dashboard</p>
            <h2 id="result-preview-title" className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#202927] sm:text-4xl">
              The important answer comes first.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#596762]">
              Route evidence remains available, but the first view explains the decision,
              the danger window, and the most useful next action.
            </p>
          </div>

          <div className="feature-surface overflow-hidden" aria-label="Example SnowRoute decision">
            <div className="grid gap-6 border-l-4 border-[#c05d1e] p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-8">
              <div>
                <p className="text-sm font-semibold text-[#a14c18]">Delay recommended</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#202927]">
                  A later departure avoids the worst visibility.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[#596762]">
                  Snow and gusting wind overlap west of Ann Arbor from 7:10–8:05 PM.
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-7 gap-y-3 border-t border-[#d9ddd6] pt-5 text-sm sm:grid-cols-1 sm:border-l sm:border-t-0 sm:pl-7 sm:pt-0">
                <div>
                  <dt className="text-[#6d7a76]">Better departure</dt>
                  <dd className="mt-1 font-semibold text-[#202927]">8:45 PM</dd>
                </div>
                <div>
                  <dt className="text-[#6d7a76]">Worst risk</dt>
                  <dd className="mt-1 font-semibold text-[#c05d1e]">High</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9ddd6] bg-[#eceee9] py-14 sm:py-16" aria-labelledby="how-home-title">
        <div className="page-container">
          <p className="eyebrow">How it works</p>
          <h2 id="how-home-title" className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#202927]">
            Three steps to a clearer call.
          </h2>
          <ol className="mt-9 grid gap-8 md:grid-cols-3 md:divide-x md:divide-[#cfd5ce]">
            {steps.map(([title, body], index) => (
              <li key={title} className="md:px-7 md:first:pl-0 md:last:pr-0">
                <span className="font-mono text-sm font-semibold text-[#176c68]">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold text-[#202927]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#596762]">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="page-container grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div>
          <p className="eyebrow">Use it as one source</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-[#202927]">
            Check official conditions before leaving.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#596762]">
            SnowRoute is a planning tool. It does not include live closures, emergency
            alerts, road treatment, or observed pavement conditions.
          </p>
          <Link href="/about" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#176c68] underline decoration-[#a9c8c2] underline-offset-4 hover:text-[#105955]">
            Read the methodology and limits
          </Link>
        </div>
        <aside className="border-l border-[#d9ddd6] pl-6">
          <p className="text-sm font-semibold text-[#202927]">Save trips across devices</p>
          <p className="mt-2 text-sm leading-6 text-[#596762]">
            Accounts are optional and not enabled in this preview. Local history works
            without signing in.
          </p>
          <Link href="/account" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#176c68] hover:text-[#105955]">
            Account and privacy details →
          </Link>
        </aside>
      </section>
    </main>
  );
}
