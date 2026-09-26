import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { PairingHeader } from "@/components/nfc/pairing-header";
import { DiagnosticPanel } from "@/components/nfc/diagnostic-panel";
import { WriteBuilder } from "@/components/nfc/write-builder";
import { CryptoWorkbench } from "@/components/nfc/crypto-workbench";
import { SecurityLog } from "@/components/nfc/security-log";
import { AutomationGrid } from "@/components/nfc/automation-grid";
import { SocketLog } from "@/components/nfc/socket-log";
import { Toaster } from "@/components/ui/sonner";
import { ensureSession } from "@/lib/nfc/station-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NFC-DDS · Command Deck" },
      {
        name: "description",
        content:
          "Command deck for the NFC Dual-Device Station: hex viewer, memory map, NDEF parser, crypto workbench, and EMV intercept log.",
      },
      { property: "og:title", content: "NFC-DDS · Command Deck" },
      {
        property: "og:description",
        content:
          "Pair a mobile NFC engine and inspect, build, write, and decrypt tags from a desktop command deck.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] space-y-4 p-4">
        <PairingHeader />
        <DiagnosticPanel />
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <WriteBuilder />
          <SecurityLog />
        </div>
        <CryptoWorkbench />
        <AutomationGrid />
        <SocketLog />
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
