import { createFileRoute } from "@tanstack/react-router";

import { WriteBuilder } from "@/components/nfc/write-builder";

export const Route = createFileRoute("/_app/write")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Write Builder" },
      {
        name: "description",
        content:
          "Compose NDEF records and stage tag write operations for the paired mobile NFC engine.",
      },
      { property: "og:title", content: "NFC-DDS · Write Builder" },
      {
        property: "og:description",
        content:
          "Compose NDEF records and stage tag write operations for the paired mobile NFC engine.",
      },
    ],
  }),
  component: WritePage,
});

function WritePage() {
  return (
    <div className="space-y-4">
      <WriteBuilder />
    </div>
  );
}
