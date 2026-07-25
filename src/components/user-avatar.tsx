import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  color,
  size = 28,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold text-white select-none",
        className,
      )}
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}