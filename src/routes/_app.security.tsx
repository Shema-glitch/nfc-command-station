import { createFileRoute } from "@tanstack/react-router";

import { SecurityLog } from "@/components/nfc/security-log";

export const Route = createFileRoute("/_app/security")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Security Log" },
      {
        name: "description",
        content:
          "EMV intercept and security event log streamed from the paired mobile NFC engine.",
      },
      { property: "og:title", content: "NFC-DDS · Security Log" },
      {
        property: "og:description",
        content:
          "Review EMV intercepts and security events captured by the paired mobile engine.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="space-y-4">
      <SecurityLog />
    </div>
  );
}
