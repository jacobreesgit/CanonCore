/**
 * Converts a Node.js readable stream to a Web ReadableStream.
 * Handles race conditions where data events may fire after close/error.
 *
 * @param nodeStream - Node.js readable stream
 * @returns Web ReadableStream of Uint8Array chunks
 */
export function nodeStreamToWeb(
  nodeStream: NodeJS.ReadableStream
): ReadableStream<Uint8Array> {
  let closed = false;

  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        if (!closed) {
          controller.enqueue(new Uint8Array(chunk));
        }
      });
      nodeStream.on("end", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
      nodeStream.on("error", (err: Error) => {
        if (!closed) {
          closed = true;
          controller.error(err);
        }
      });
    },
    cancel() {
      closed = true;
      // Destroy the node stream if it supports it
      if ("destroy" in nodeStream && typeof nodeStream.destroy === "function") {
        nodeStream.destroy();
      }
    },
  });
}
