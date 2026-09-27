import { createFileRoute } from "@tanstack/react-router";

import { SocketLog } from "@/components/nfc/socket-log";

export const Route = createFileRoute("/_app/logs")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Socket Log" },
      {
        name: "description",
        content:
          "Live relay socket traffic between the desktop station and the paired mobile NFC engine.",
      },
      { property: "og:title", content: "NFC-DDS · Socket Log" },
      {
        property: "og:description",
        content:
          "Inspect live relay socket traffic between the desktop station and mobile engine.",
      },
    ],
  }),
  component: LogsPage,
});

function LogsPage() {
  return (
    <div className="space-y-4">
      <SocketLog />
    </div>
  );
}
