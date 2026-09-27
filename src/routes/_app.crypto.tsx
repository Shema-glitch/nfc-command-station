import { createFileRoute } from "@tanstack/react-router";

import { CryptoWorkbench } from "@/components/nfc/crypto-workbench";

export const Route = createFileRoute("/_app/crypto")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Crypto Workbench" },
      {
        name: "description",
        content:
          "Off-thread crypto workbench for NFC tag keys: derive, encrypt, and decrypt sector data in a worker.",
      },
      { property: "og:title", content: "NFC-DDS · Crypto Workbench" },
      {
        property: "og:description",
        content:
          "Derive keys and encrypt or decrypt NFC sector data off the main thread.",
      },
    ],
  }),
  component: CryptoPage,
});

function CryptoPage() {
  return (
    <div className="space-y-4">
      <CryptoWorkbench />
    </div>
  );
}
