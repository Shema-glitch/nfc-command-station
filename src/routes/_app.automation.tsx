import { createFileRoute } from "@tanstack/react-router";

import { AutomationGrid } from "@/components/nfc/automation-grid";

export const Route = createFileRoute("/_app/automation")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Automation" },
      {
        name: "description",
        content:
          "Automation pipelines for batch tag operations across the paired NFC devices.",
      },
      { property: "og:title", content: "NFC-DDS · Automation" },
      {
        property: "og:description",
        content:
          "Configure and monitor automation pipelines for batch NFC tag operations.",
      },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  return (
    <div className="space-y-4">
      <AutomationGrid />
    </div>
  );
}
