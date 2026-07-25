import { STATUS_META, type ProjectStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}