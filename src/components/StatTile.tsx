export default function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "safety" | "amber" | "steel";
}) {
  const accentClass =
    accent === "safety"
      ? "text-safety"
      : accent === "amber"
        ? "text-amber"
        : "text-ink";

  return (
    <div className="rounded-lg border border-ink/10 bg-paper px-5 py-4 animate-rise-in">
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </p>
      <p className={`mt-1 font-display text-4xl leading-none ${accentClass}`}>{value}</p>
    </div>
  );
}
