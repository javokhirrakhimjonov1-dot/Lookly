import { removeBackground } from "@imgly/background-removal-node";

// A small red square (16x16 PNG) base64
const SMALL_RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVR42mP8z8BQDwVMgDFyAgAwswHflv4n5QAAAABJRU5ErkJggg==";

async function test() {
  console.log("Starting test...");
  try {
    const buf = Buffer.from(SMALL_RED_PNG, "base64");
    // Create a Blob with a specific mime type
    const blob = new Blob([buf], { type: "image/png" });
    const result = await removeBackground(blob, {
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
