import { useEffect, useRef } from "react";
import type { CryptoJob, CryptoResult } from "./crypto-worker";

export function useCryptoWorker(onMessage: (msg: CryptoResult) => void) {
  const workerRef = useRef<Worker | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    // The worker is instantiated only in the browser, well after hydration.
    const worker = new Worker(new URL("./crypto-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const listener = (event: MessageEvent<CryptoResult>) => handlerRef.current(event.data);
    worker.addEventListener("message", listener);
    return () => {
      worker.removeEventListener("message", listener);
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    post(job: CryptoJob) {
      workerRef.current?.postMessage(job);
    },
  };
}
