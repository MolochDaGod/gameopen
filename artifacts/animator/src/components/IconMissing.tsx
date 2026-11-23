import "./iconMissing.css";

/** Visible "icon missing" marker. Never a stand-in image. */
export function IconMissing({
  className,
  label = "icon missing",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={["icon-missing", className].filter(Boolean).join(" ")}
      title={label}
      role="img"
      aria-label={label}
    >
      {label}
    </span>
  );
}
