/**
 * Fixed, full-viewport ambient layer rendered behind all content:
 * subtle grid, two drifting blurred gradient orbs, and a faint
 * film-grain noise overlay. Purely decorative (aria-hidden) and
 * pointer-transparent; motion is disabled via CSS when the user
 * prefers reduced motion.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="grid-bg h-full w-full" />
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="noise" />
    </div>
  );
}
