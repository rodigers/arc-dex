/** Real chain logo (or letter avatar fallback) used across bridge UI. */
import { chainLogo, chainColor } from "@/lib/chainLogos";

export function ChainIcon({
  chainLabel,
  size = 20,
}: {
  chainLabel: string;
  size?: number;
}) {
  const { logo } = chainLogo(chainLabel);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--border)] object-cover"
        draggable={false}
      />
    );
  }
  const initial = chainLabel.charAt(0).toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ width: size, height: size, background: chainColor(chainLabel) }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
