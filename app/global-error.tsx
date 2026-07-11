"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f4f3ee", color: "#202927", fontFamily: "Avenir, Segoe UI, system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
          <section style={{ width: "min(620px, 100%)", border: "1px solid #28414c", borderRadius: "16px", background: "#102630", padding: "28px" }}>
            <p style={{ margin: 0, color: "#9bc8cd", fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
              SnowRoute interruption
            </p>
            <h1 style={{ margin: "14px 0 0", fontSize: "30px", lineHeight: 1.15 }}>
              The application could not load this view.
            </h1>
            <p style={{ margin: "14px 0 0", color: "#c8d4d8", lineHeight: 1.65 }}>
              Retry the page. If the problem continues, return later and check official road
              and weather sources before making a travel decision.
            </p>
            {error.digest ? (
              <p style={{ margin: "12px 0 0", color: "#91a5ad", fontSize: "12px" }}>
                Reference: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => unstable_retry()}
              style={{ marginTop: "22px", minHeight: "44px", border: 0, borderRadius: "10px", background: "#76d5d1", color: "#07161d", padding: "0 18px", fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
