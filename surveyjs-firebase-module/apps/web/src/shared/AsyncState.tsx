import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="centered-state" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

export function MessageState({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: ReactNode;
  tone?: "neutral" | "error" | "success";
}) {
  return (
    <main className={`centered-state message-state message-state--${tone}`}>
      <h1>{title}</h1>
      <div>{children}</div>
    </main>
  );
}
