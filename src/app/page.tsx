import { Journey, type Panel } from "@/components/journey/journey";
import { DriveMount } from "@/components/drive/drive-mount";
import {
  PanelHero,
  PanelBooking,
  PanelServices,
  PanelFleet,
  PanelFares,
  PanelReviews,
  PanelFaq,
  PanelDropOff,
} from "@/components/journey/panels";

/**
 * The site is a drive. You sit in the cab, follow the overhead signs, and
 * turn off the boulevard for whichever section you want.
 *
 * The same sections are also rendered here as the classic scrolling journey.
 * That copy is what the server sends every time — it is the accessible and
 * indexable version of the site, and the destination of every "skip the
 * drive" control. The 3D build only loads for visitors who can use it.
 */

const panels: Panel[] = [
  { id: "top", label: "Pick-up", node: <PanelHero /> },
  { id: "book", label: "Book", node: <PanelBooking /> },
  { id: "services", label: "Services", node: <PanelServices /> },
  { id: "fleet", label: "Fleet", node: <PanelFleet /> },
  { id: "fares", label: "Fares", node: <PanelFares /> },
  { id: "reviews", label: "Reviews", node: <PanelReviews /> },
  { id: "faq", label: "FAQ", node: <PanelFaq /> },
  { id: "call", label: "Drop-off", node: <PanelDropOff /> },
];

/** Keyed by destination id in `src/lib/drive/world-map.ts`. */
const sections = {
  book: <PanelBooking />,
  services: <PanelServices />,
  fleet: <PanelFleet />,
  fares: <PanelFares />,
  reviews: <PanelReviews />,
  faq: <PanelFaq />,
  call: <PanelDropOff />,
};

export default function Home() {
  return (
    <main id="main">
      <DriveMount
        hero={<PanelHero />}
        sections={sections}
        classic={<Journey panels={panels} />}
      />
    </main>
  );
}
