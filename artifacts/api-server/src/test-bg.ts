import { removeBackground } from "@imgly/background-removal-node";
import fs from "node:fs";
import path from "node:path";

// A small red square (16x16 PNG) base64
const SMALL_RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVR42mP8z8BQDwVMgDFyAgAwswHflv4n5QAAAABJRU5ErkJggg==";

async function test() {
  console.log("Starting test...");
  try {
    const buf = Buffer.from(SMALL_RED_PNG, "base64");
    const result = await removeBackground(buf, {
      model: "medium",
      output: { format: "image/png", quality: 0.8 }
    });
    const arrayBuffer = await result.arrayBuffer();
    console.log("Success! Output buffer size:", arrayBuffer.byteLength);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
