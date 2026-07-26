import {
  ShieldCheck,
  CreditCard,
  Clock,
  MapPin,
  Plane,
  Briefcase,
  Package,
  HeartPulse,
  GraduationCap,
  PartyPopper,
  Phone,
  Mail,
  Star,
} from "lucide-react";
import { BrutalButton } from "@/components/ui/brutal-button";
import { BookingForm } from "@/components/site/booking-form";
import { HeroMotion } from "@/components/motion/hero-motion";
import { Magnetic } from "@/components/motion/magnetic";
import { CountUp } from "@/components/motion/count-up";
import { site } from "@/lib/site";

/**
 * Mobile-first panels: each section stacks vertically with full-width
 * cards and readable type. Desktop keeps multi-column layouts.
 */

const eyebrow =
  "text-yellow text-[0.7rem] font-bold tracking-[0.18em] uppercase lg:text-[0.65rem] lg:tracking-[0.2em]";
const h2 =
  "font-display text-cream uppercase text-[clamp(1.45rem,4.8vw,3rem)] leading-[0.95]";
const body = "text-cream-dim text-sm leading-snug lg:text-base lg:leading-relaxed";

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full px-0 lg:max-w-6xl lg:px-10">{children}</div>;
}

function SectionIntro({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header>
      <p className={eyebrow}>{label}</p>
      <h2 className={`${h2} mt-2 lg:mt-3`}>{title}</h2>
      {children}
    </header>
  );
}

function MobileCallStrip({ headline, sub }: { headline: string; sub?: string }) {
  return (
    <a
      href={site.phoneHref}
      className="border-ink bg-yellow on-yellow flex min-h-[52px] touch-manipulation items-center justify-between gap-3 border-4 px-4 py-3 shadow-[4px_4px_0_var(--ink)] transition-opacity duration-200 active:opacity-90 lg:hidden"
    >
      <span className="text-left">
        {sub && (
          <span className="block text-[0.65rem] font-bold tracking-[0.16em] uppercase">{sub}</span>
        )}
        <span className="font-display tabular mt-0.5 block text-lg uppercase">{headline}</span>
      </span>
      <span className="border-ink bg-ink text-yellow flex h-11 w-11 shrink-0 items-center justify-center border-2">
        <Phone className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
      </span>
    </a>
  );
}

/* ---------------------------------------------------------------- Pick-up */

const trust = [
  { icon: ShieldCheck, label: "Licensed & insured" },
  { icon: CreditCard, label: "Card in every cab" },
  { icon: Clock, label: "24/7 dispatch" },
  { icon: MapPin, label: "Fixed airport fares" },
];

export function PanelHero() {
  return (
    <Shell>
      <HeroMotion>
        <div id="top" className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-8">
          <div>
            <p data-hero-item className={`${eyebrow} border-yellow inline-block border-2 px-2.5 py-1`}>
              {site.licence}
            </p>

            <h1
              data-hero-title
              className="font-display text-cream mt-3 text-[clamp(1.75rem,6vw,4.5rem)] uppercase leading-[0.92]"
            >
              <span data-hero-split>
                A cab at your
                <br />
                door in
              </span>{" "}
              <span className="relative inline-block px-2 py-0.5 lg:px-3">
                <span
                  data-hero-highlight
                  aria-hidden="true"
                  className="bg-yellow absolute inset-0 -rotate-1"
                />
                <span data-hero-punch className="text-ink relative">
                  8 minutes
                </span>
              </span>
            </h1>

            <p data-hero-item className={`${body} mt-3 max-w-[46ch]`}>
              The local, family-run cab firm for Riverside since {site.since}. No
              surge pricing, no waiting on an app — a fixed price and a driver
              who knows the roads.
            </p>

            <div data-hero-item className="mt-5 flex flex-col gap-3 lg:mt-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
              <Magnetic className="w-full lg:w-auto">
                <a href="#book" className="block w-full lg:w-auto">
                  <BrutalButton
                    color="var(--yellow)"
                    textColor="var(--ink)"
                    borderColor="var(--yellow)"
                    shadowColor="var(--yellow-deep)"
                    className="min-h-[52px] w-full text-base uppercase lg:min-h-0 lg:w-auto lg:text-sm"
                    tabIndex={-1}
                  >
                    Get in
                  </BrutalButton>
                </a>
              </Magnetic>
              <a
                href={site.phoneHref}
                className="text-cream hover:text-yellow tabular hover:border-yellow inline-flex min-h-[48px] touch-manipulation items-center justify-center border-b-2 border-transparent text-sm font-bold transition-colors duration-200 lg:min-h-[44px] lg:justify-start lg:text-base"
              >
                or call {site.phone}
              </a>
            </div>
          </div>

          <ul data-hero-item className="grid grid-cols-2 gap-3 lg:gap-3">
            {trust.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="border-ink-line bg-ink-soft flex min-h-[56px] items-center gap-2.5 border-2 p-3 lg:min-h-0 lg:gap-2.5 lg:p-3"
              >
                <Icon className="text-yellow h-5 w-5 shrink-0 lg:h-5 lg:w-5" aria-hidden="true" strokeWidth={2.5} />
                <span className="text-cream text-sm font-semibold leading-tight lg:text-sm">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </HeroMotion>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Booking */

export function PanelBooking() {
  return (
    <Shell>
      <div id="book" className="flex flex-col gap-4 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-8">
        <MobileCallStrip sub="Need it within the hour?" headline="Call dispatch" />

        <div className="lg:sticky lg:top-8">
          <SectionIntro label="Booking" title="Where to?">
            <p className={`${body} mt-3 max-w-[34ch]`}>
              We confirm the car and the fixed fare by phone within five minutes.
              Travelling within the hour? Calling is faster.
            </p>
          </SectionIntro>
          <a
            href={site.phoneHref}
            className="font-display text-yellow tabular mt-4 hidden text-[clamp(1.15rem,3vw,2.25rem)] lg:inline-block"
          >
            {site.phone}
          </a>
        </div>

        <BookingForm />
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------- Services */

const services = [
  { icon: Plane, title: "Airport transfers", body: "Fixed fares, flight tracked, no charge for delays." },
  { icon: Briefcase, title: "Business accounts", body: "Monthly invoicing and named, priority drivers." },
  { icon: Package, title: "Parcel & courier", body: "Same-day across the county, tracked door to door." },
  { icon: HeartPulse, title: "Hospital runs", body: "Mobility-trained drivers, accessible vehicles." },
  { icon: GraduationCap, title: "School contracts", body: "DBS-checked drivers on fixed daily routes." },
  { icon: PartyPopper, title: "Nights & events", body: "Pre-booked returns and eight-seaters for groups." },
];

export function PanelServices() {
  return (
    <Shell>
      <div id="services">
        <SectionIntro label="What we do" title="Every journey, covered" />

        <ul className="mt-5 flex flex-col gap-3 lg:mt-8 lg:grid lg:grid-cols-3 lg:gap-4">
          {services.map(({ icon: Icon, title, body: desc }) => (
            <li
              key={title}
              className="border-ink-line bg-ink-soft hover:border-yellow flex gap-3 border-2 p-4 transition-colors duration-200 lg:block lg:p-5"
            >
              <span className="border-yellow bg-yellow text-ink flex h-11 w-11 shrink-0 items-center justify-center border-2 lg:mb-0 lg:h-10 lg:w-10">
                <Icon className="h-5 w-5 lg:h-5 lg:w-5" aria-hidden="true" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-cream text-base uppercase leading-tight lg:mt-4 lg:text-lg">{title}</h3>
                <p className={`${body} mt-1.5 text-sm lg:mt-2`}>{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ Fleet */

const fleet = [
  { name: "Saloon", seats: "1–4", bags: "2", from: 3.2, note: "The everyday cab. Best value for short hops." },
  { name: "Estate", seats: "1–4", bags: "4", from: 4.1, note: "Extra boot space for airport runs.", featured: true },
  { name: "8-Seater", seats: "5–8", bags: "8", from: 5.6, note: "One vehicle instead of two cabs." },
];

export function PanelFleet() {
  return (
    <Shell>
      <div id="fleet">
        <SectionIntro label="The fleet" title="Pick your ride" />

        <ul className="mt-5 flex flex-col gap-3 lg:mt-8 lg:grid lg:grid-cols-3 lg:gap-5">
          {[...fleet].sort((a, b) => Number(b.featured) - Number(a.featured)).map((v) => (
            <li
              key={v.name}
              className={
                "flex flex-col " +
                (v.featured
                  ? "border-yellow bg-ink-soft border-4 p-4 shadow-[4px_4px_0_var(--yellow)] lg:p-6 lg:shadow-[8px_8px_0_var(--yellow)]"
                  : "border-ink-line bg-ink-soft border-2 p-4 lg:p-6")
              }
            >
              {v.featured && (
                <p className="bg-yellow text-ink mb-2 inline-block self-start px-2 py-0.5 text-xs font-bold tracking-wide uppercase lg:mb-3 lg:text-[0.6rem]">
                  Most booked
                </p>
              )}
              <h3 className="font-display text-cream text-xl uppercase lg:text-2xl">{v.name}</h3>
              <p className={`${body} mt-2 mb-3 text-sm lg:mb-4`}>{v.note}</p>
              <dl className="border-ink-line mt-auto grid gap-2 border-t-2 pt-3 text-sm lg:gap-1.5 lg:pt-4">
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Seats</dt>
                  <dd className="text-cream tabular font-semibold">{v.seats}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Bags</dt>
                  <dd className="text-cream tabular font-semibold">{v.bags}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-cream-dim">From</dt>
                  <dd className="text-yellow tabular text-lg font-bold lg:text-xl">
                    <CountUp value={v.from} prefix="£" />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ Fares */

const fares = [
  { route: "Town centre — Riverside Airport", time: "28 min", price: 34.0 },
  { route: "Town centre — Northgate Station", time: "11 min", price: 12.5 },
  { route: "Riverside — Ashbourne Village", time: "19 min", price: 21.8 },
  { route: "Town centre — County Hospital", time: "14 min", price: 15.4 },
  { route: "Riverside — Harbour Retail Park", time: "9 min", price: 10.9 },
];

export function PanelFares() {
  return (
    <Shell>
      <div id="fares">
        <SectionIntro label="Fares" title="Fixed. No meters.">
          <p className={`${body} mt-2 max-w-[60ch] lg:mt-3`}>
            Saloon fares at the daytime rate. Evening and bank-holiday journeys
            carry a 10% surcharge, quoted before you book.
          </p>
        </SectionIntro>

        {/* Mobile: card list — avoids cramped table */}
        <ul className="mt-5 flex flex-col gap-2 lg:hidden">
          {fares.map((f) => (
            <li
              key={f.route}
              className="border-ink-line bg-ink-soft flex items-start justify-between gap-3 border-2 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-cream text-sm leading-snug font-semibold">{f.route}</p>
                <p className="text-cream-dim tabular mt-1 text-xs">{f.time} typical</p>
              </div>
              <p className="text-yellow tabular shrink-0 text-lg font-bold">
                <CountUp value={f.price} prefix="£" />
              </p>
            </li>
          ))}
        </ul>

        <div className="border-ink-line mt-6 hidden border-2 lg:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Fixed daytime fares for popular local routes</caption>
            <thead>
              <tr className="bg-yellow text-ink">
                <th scope="col" className="px-4 py-2.5 text-xs font-bold uppercase">Route</th>
                <th scope="col" className="px-4 py-2.5 text-xs font-bold uppercase">Typical</th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold uppercase">Fare</th>
              </tr>
            </thead>
            <tbody>
              {fares.map((f) => (
                <tr key={f.route} className="border-ink-line border-t-2">
                  <th scope="row" className="text-cream px-4 py-3 font-semibold">{f.route}</th>
                  <td className="text-cream-dim tabular px-4 py-3">{f.time}</td>
                  <td className="text-yellow tabular px-4 py-3 text-right font-bold">
                    <CountUp value={f.price} prefix="£" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Reviews */

const reviews = [
  { quote: "Booked a 4am airport run and expected to be let down. The car was outside at 3:52 and the driver had already checked our flight.", name: "Priya N.", detail: "Airport transfer" },
  { quote: "We moved the office account across last year. One invoice a month, and they hold a car for a late meeting without being asked twice.", name: "Tom Whitfield", detail: "Business account" },
  { quote: "My mum uses them for hospital appointments. Same driver most weeks, helps her with the door and the shopping. An app does not do that.", name: "Karen S.", detail: "Hospital runs" },
];

export function PanelReviews() {
  return (
    <Shell>
      <div id="reviews">
        <SectionIntro label="Reviews" title="Regulars, not one-offs">
          <p className={`${body} mt-2 flex flex-wrap items-center gap-2 lg:mt-3`}>
            <span className="flex" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="text-yellow h-4 w-4 fill-current" />
              ))}
            </span>
            <span className="tabular text-cream font-bold">4.8</span>
            <span>from 1,240 local reviews</span>
          </p>
        </SectionIntro>

        <ul className="mt-5 flex flex-col gap-3 lg:mt-8 lg:grid lg:grid-cols-3 lg:gap-5">
          {reviews.map((r) => (
            <li key={r.name} className="border-ink-line bg-ink-soft flex flex-col border-2 p-4 lg:p-5">
              <figure className="flex h-full flex-col">
                <blockquote className="text-cream flex-1 text-sm leading-relaxed lg:text-base">
                  &ldquo;{r.quote}&rdquo;
                </blockquote>
                <figcaption className="border-ink-line mt-3 border-t-2 pt-3 lg:mt-4">
                  <span className="font-display text-yellow block text-sm uppercase">{r.name}</span>
                  <span className="text-cream-dim text-xs">{r.detail}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------- FAQ */

const faqs = [
  { q: "How far ahead should I book?", a: "For a cab now, call — we are usually with you inside ten minutes. For airport runs, book the night before." },
  { q: "Is the price really fixed?", a: "Yes. Traffic and roadworks are our problem. Only changing the destination changes the fare." },
  { q: "Can I pay by card?", a: "Every vehicle takes contactless, chip and pin and phone wallets. Nothing is charged online." },
  { q: "Do you carry wheelchair users?", a: "Four wheelchair-accessible vehicles with ramp access. Mention it when booking." },
  { q: "What if my flight is delayed?", a: "We track inbound flights and move the pickup automatically. No waiting charge." },
  { q: "Which areas do you cover?", a: "Riverside and every village within roughly twenty miles, plus pre-booked long-distance." },
];

export function PanelFaq() {
  return (
    <Shell>
      <div id="faq">
        <SectionIntro label="Questions" title="Before you book" />

        <dl className="mt-5 flex flex-col gap-4 lg:mt-8 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:gap-y-5">
          {faqs.map((f, i) => (
            <div key={f.q} className="border-ink-line flex gap-3 border-t-2 pt-4 lg:block lg:gap-0 lg:pt-4">
              <span className="bg-yellow text-ink flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold lg:hidden">
                {i + 1}
              </span>
              <div>
                <dt className="font-display text-cream text-sm uppercase leading-tight lg:text-sm">{f.q}</dt>
                <dd className={`${body} mt-2 text-sm lg:mt-2`}>{f.a}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </Shell>
  );
}

/* --------------------------------------------------------------- Drop-off */

export function PanelDropOff() {
  const contact = [
    { icon: Phone, label: site.phone, href: site.phoneHref, tabular: true },
    { icon: Mail, label: site.email, href: `mailto:${site.email}` },
    { icon: MapPin, label: site.address },
    { icon: Clock, label: site.hours },
  ];

  return (
    <Shell>
      <div id="call" className="flex flex-col gap-5 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
        <MobileCallStrip headline={site.phone} sub="Need a cab now?" />

        <div className="border-ink bg-yellow on-yellow hidden border-4 p-7 shadow-[10px_10px_0_var(--ink)] lg:block">
          <h2 className="font-display text-ink text-[clamp(1.25rem,4vw,3rem)] uppercase leading-[0.95]">
            Need a cab now?
          </h2>
          <p className="text-ink mt-3 text-base leading-relaxed font-medium">
            Dispatch is staffed around the clock. Call and we will have a car on
            its way before you finish giving the address.
          </p>
          <div className="mt-6 flex flex-row items-center gap-3">
            <Magnetic>
              <a href={site.phoneHref}>
                <BrutalButton
                  color="var(--ink)"
                  textColor="var(--yellow)"
                  borderColor="var(--ink)"
                  shadowColor="var(--ink)"
                  className="text-base uppercase"
                  tabIndex={-1}
                >
                  <Phone className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
                  <span className="tabular">{site.phone}</span>
                </BrutalButton>
              </a>
            </Magnetic>
            <a
              href="#book"
              className="text-ink border-ink inline-flex min-h-[48px] items-center border-b-2 text-sm font-bold uppercase"
            >
              Or book online
            </a>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 lg:gap-3">
            <span className="checker border-ink block h-8 w-8 border-2" aria-hidden="true" />
            <span className="font-display text-cream text-lg">
              YELLOW<span className="text-yellow">LINE</span>
            </span>
          </div>
          <p className={`${body} mt-3 max-w-[38ch]`}>
            {site.tagline} Family-run since {site.since}, and still answering the
            phone ourselves.
          </p>

          <ul className="mt-4 grid gap-1 lg:mt-5">
            {contact.map(({ icon: Icon, label, href, tabular }) => (
              <li key={label}>
                {href ? (
                  <a
                    href={href}
                    className="text-cream-dim hover:text-yellow flex min-h-[48px] touch-manipulation items-center gap-3 text-sm transition-colors duration-200 lg:min-h-[44px] lg:gap-2.5"
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={tabular ? "tabular text-base font-semibold lg:text-sm lg:font-normal" : undefined}>
                      {label}
                    </span>
                  </a>
                ) : (
                  <span className="text-cream-dim flex min-h-[48px] items-center gap-3 text-sm lg:min-h-[44px] lg:gap-2.5">
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {label}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-col gap-3 lg:hidden">
            <a href="#book" className="block w-full">
              <BrutalButton
                color="var(--yellow)"
                textColor="var(--ink)"
                borderColor="var(--yellow)"
                shadowColor="var(--yellow-deep)"
                className="min-h-[52px] w-full text-base uppercase"
                tabIndex={-1}
              >
                Book online
              </BrutalButton>
            </a>
          </div>

          <p className="border-ink-line text-cream-dim mt-4 border-t-2 pt-3 text-xs lg:mt-5 lg:pt-4">
            © {new Date().getFullYear()} {site.name}. {site.licence}. Placeholder
            content — replace before launch.
          </p>
        </div>
      </div>
    </Shell>
  );
}
