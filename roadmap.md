# NFC-DDS roadmap

- [x] Core libs (bytes, NDEF, chip/AID, station store, crypto worker)
- [x] Design tokens (slate/midnight/indigo, mono utility)
- [x] Desktop dashboard: pairing header + QR, diagnostic panel, hex+ASCII viewer, memory map, NDEF list
- [x] Payload write builder (Text / URI / vCard / Wi-Fi / Bluetooth) with real NDEF serialization
- [x] Crypto workbench with off-thread web worker (entropy + AES/3DES iteration)
- [x] EMV AID intercept log
- [x] Automation rules grid with live IF/THEN evaluation
- [x] Live socket log
- [x] Mobile companion `/mobile` — auto-connects from QR, Web NFC scanning + AID emit

Notes:
- Needs a Socket.io relay reachable at `VITE_NFC_RELAY_URL` (defaults to ws://<host>:8443). Any relay that forwards frames between `role=desktop` and `role=mobile` sockets works.
- Mobile scanning requires Android Chrome served over HTTPS (Web NFC).
