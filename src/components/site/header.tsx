"use client";

import { useEffect, useState } from "react";
import { Menu, X, Phone } from "lucide-react";
import { BrutalButton } from "@/components/ui/brutal-button";
import { nav, site } from "@/lib/site";

export function Header() {
  const [open, setOpen] = useState(false);

  // Escape route out of the mobile menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="border-ink-line bg-ink/95 sticky top-0 z-50 hidden border-b-2 backdrop-blur-sm lg:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <a
          href="#top"
          className="flex min-h-[44px] items-center gap-3"
          aria-label={`${site.name} — home`}
        >
          <span className="checker border-ink block h-9 w-9 border-2" aria-hidden="true" />
          <span className="font-display text-cream text-lg leading-none sm:text-xl">
            YELLOW<span className="text-yellow">LINE</span>
          </span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-cream hover:text-yellow flex min-h-[44px] items-center text-sm font-semibold tracking-wide uppercase transition-colors duration-200"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href={site.phoneHref} className="hidden sm:block">
            <BrutalButton
              color="var(--yellow)"
              textColor="var(--ink)"
              borderColor="var(--ink)"
              shadowColor="var(--yellow-deep)"
              className="text-sm"
              tabIndex={-1}
            >
              <Phone className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
              <span className="tabular font-bold">{site.phone}</span>
            </BrutalButton>
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="border-ink-line text-cream hover:border-yellow hover:text-yellow flex h-12 w-12 cursor-pointer items-center justify-center border-2 transition-colors duration-200 lg:hidden"
          >
            {open ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-ink-line bg-ink border-t-2 lg:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-5 py-3 sm:px-8">
            <ul>
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-ink-line text-cream hover:text-yellow flex min-h-[52px] items-center border-b text-base font-semibold tracking-wide uppercase transition-colors duration-200"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={site.phoneHref}
                  className="text-yellow tabular flex min-h-[52px] items-center gap-2 text-base font-bold"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" strokeWidth={2.5} />
                  {site.phone}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
