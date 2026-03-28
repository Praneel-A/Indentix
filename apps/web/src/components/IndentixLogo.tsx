/** Brand mark from `/public/indentix-logo.png` (transparent PNG). */
export function IndentixLogo({
  className = "h-16 w-16",
  alt = "Indentix",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/indentix-logo.png"
      alt={alt}
      width={128}
      height={128}
      className={`object-contain select-none ${className}`}
      draggable={false}
    />
  );
}
