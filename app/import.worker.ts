/// <reference lib="webworker" />
import { importSources } from "../lib/import.mjs";
self.onmessage = async (event: MessageEvent<File[]>) => {
  try {
    const result = await importSources(event.data, (progress: any) =>
      self.postMessage({ type: "progress", progress }),
    );
    self.postMessage({ type: "complete", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Unable to read this export. Use a fresh ZIP or CSV files.",
    });
  }
};
export {};
