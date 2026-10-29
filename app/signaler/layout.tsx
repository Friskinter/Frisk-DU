import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Signaler un accident ou un danger",
  // Lien secret propre à chaque entreprise : il ne doit pas être indexé.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function LayoutSignaler({ children }: { children: ReactNode }) {
  return children;
}
