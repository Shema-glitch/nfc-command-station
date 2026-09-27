import { createFileRoute } from "@tanstack/react-router";

import { PairingHeader } from "@/components/nfc/pairing-header";
import { DiagnosticPanel } from "@/components/nfc/diagnostic-panel";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Overview" },
      {
        name: "description",
        content:
          "Station overview: pair a mobile NFC engine, inspect live tag hex and memory maps, and monitor session health.",
      },
      { property: "og:title", content: "NFC-DDS · Overview" },
      {
        property: "og:description",
        content:
          "Pair a mobile NFC engine and inspect live tag hex, memory maps, and NDEF records from the desktop command deck.",
      },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <div className="space-y-4">
      <PairingHeader />
      <DiagnosticPanel />
    </div>
  );
}
