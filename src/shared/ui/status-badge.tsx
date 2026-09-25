type StatusTone = "positive" | "negative" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  positive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  negative: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}
