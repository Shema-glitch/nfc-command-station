# NFC Command Center

Build a production-ready, full-stack real-time web application called 'NFC Dual-Device Station (NFC-DDS)' for NFC hardware engineers, security analysts, and developers. The main purpose of the app is to serve as a high-performance desktop command center that pairs with a mobile device to inspect, read, parse, build, write, and decrypt live NFC tags.
Do not generate fake user simulation loops, placeholder UI toggle arrays, or front-end buttons that fabricate fake data. Every module must be backed by real event-listeners, authentic Socket.io event hooks, and real web-worker messaging routes designed to handle real incoming buffer payloads.
Key Features & Views:
1. Dynamic QR Pairing Modal & Socket Status: Display a prominent header bar with live connection status (Disconnected/Connected) and a 'Pair Mobile Engine' button that pops up a dynamic QR code containing a secure, authenticated session WebSocket token (ws://host:port?token=AUTH_KEY) for low-latency TCP tunneling.
2. The Diagnostic Read Dashboard: A telemetry view that listens for 'mobile-scan-result' socket events to populate physical tag properties (UID byte array, Chip Manufacturer [NXP, STMicroelectronics, Infineon], RF Protocol ISO 14443-A/B), a visual memory storage meter (Used vs Free bytes), a structured NDEF record parser (Text, URIs, Smart Posters, vCards), and a real-time side-by-side Hex Dump & ASCII viewer window using clean monospaced typography.
3. The Payload Write Builder: Interactive form assembly for queuing write payloads (Plaintext, HTTP/HTTPS links, vCards, Wi-Fi SSID/WPA2 configurations, and Bluetooth MAC pairings). Clicking a 'Burn Payload to Phone' trigger button must serialize the form data and immediately emit a 'desktop-operation-prepared' socket command down to the connected mobile engine.
4. Multithreaded Cryptographic Workbench: An off-thread crypto execution terminal utilizing background Web Workers (crypto-worker.js) linked to CryptoJS. It must automatically perform entropy analysis on incoming buffers (flagging high randomness as 'Encrypted Data') and run live, non-blocking passphrase iterations against symmetric (AES-128/256, Triple DES) and asymmetric key containers with live decrypted output previews without locking the main UI thread.
5. Edge Security Log & Interception Tracker: A dedicated security monitor log tracking local EMV Application Identifier (AID) block events emitted by the mobile client. Display alert badges and timestamps whenever financial payloads (Visa, Mastercard, AMEX AIDs) are safely intercepted and dropped at the hardware layer before network transmission.
6. Automation Task Engine: A structural rules grid allowing developers to construct stacked macro device execution profiles and conditional IF/THEN execution logic for deployed tags.
Design & Vibe:
- Dark-mode, high-density industrial control panel aesthetic with slate (#0f172a), midnight blue (#1e1b4b), indigo accents (#6366f1), and glowing status indicators (emerald green for active connections, crimson for security blocks).
- Clean monospaced typography for hex fields, byte streams, and terminal logs.
- Avoid abstract or cyberpunk aesthetic tropes. It must look like an enterprise engineering workstation (e.g., Datadog, AWS Console) where modular data blocks fit together symmetrically in a clean, satisfying design system where components work together to build a professional user interface.
The Desktop Command Dashboard — outline the first version with the hex visualizer, memory maps, and QR pairing display.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4de85dda-65e4-4b79-a3e8-10f7ff30f402).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
