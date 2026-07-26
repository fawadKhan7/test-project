/**
 * Single source of truth for business details.
 * Placeholder content — swap for the real business before going live.
 * Phone numbers use the 555 reserved range so nothing real is dialled.
 */

export const site = {
  name: "Yellow Line Taxi",
  tagline: "Your city, door to door.",
  phone: "(555) 019-2847",
  phoneHref: "tel:+15550192847",
  email: "dispatch@yellowline.example",
  address: "142 Depot Street, Riverside",
  hours: "24 hours a day, 365 days a year",
  licence: "Council licence #TX-40219",
  since: "1998",
} as const;

export const nav = [
  { label: "Services", href: "#services" },
  { label: "Fleet", href: "#fleet" },
  { label: "Fares", href: "#fares" },
  { label: "Reviews", href: "#reviews" },
  { label: "FAQ", href: "#faq" },
] as const;

