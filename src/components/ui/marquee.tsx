/**
 * Marquee — from 21st.dev (@ekmas/marquee).
 * Original dual-track technique preserved (both tracks are required for the
 * seamless loop). Local changes: neobrutalism registry classes swapped for
 * this project's yellow/black tokens, and the duplicated text hidden from
 * assistive tech so the strip is announced exactly once.
 */

export default function Marquee({ items }: { items: string[] }) {
  return (
    <div
      className="border-ink bg-yellow text-ink relative flex w-full overflow-x-hidden border-y-4"
      role="group"
      aria-label={items.join(". ")}
    >
      <div className="animate-marquee py-5 whitespace-nowrap" aria-hidden="true">
        {items.map((item) => (
          <span
            key={item}
            className="font-display mx-6 text-2xl tracking-tight uppercase sm:text-3xl"
          >
            {item}
          </span>
        ))}
      </div>

      <div
        className="animate-marquee2 absolute top-0 py-5 whitespace-nowrap"
        aria-hidden="true"
      >
        {items.map((item) => (
          <span
            key={item}
            className="font-display mx-6 text-2xl tracking-tight uppercase sm:text-3xl"
          >
            {item}
          </span>
        ))}
      </div>

      {/* must have both of these in order to work */}
    </div>
  );
}
