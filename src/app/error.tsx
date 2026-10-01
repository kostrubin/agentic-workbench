"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="boot-state">
      <h1>We couldn’t open the workbench</h1>
      <p>
        Make sure PostgreSQL is running and the database migrations have been
        applied.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
