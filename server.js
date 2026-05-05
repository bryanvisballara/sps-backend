// Render is configured to run `node server.js` from repository root.
// This file forwards startup to the compiled API entrypoint.
(async () => {
  try {
    await import("./apps/api/dist/server.js");
  } catch (error) {
    console.error("Failed to start API from ./apps/api/dist/server.js");
    console.error(error);
    process.exit(1);
  }
})();
