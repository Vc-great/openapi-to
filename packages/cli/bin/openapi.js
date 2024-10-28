#!/usr/bin/env node
try {
  require("source-map-support").install({
    handleUncaughtExceptions: false,
  });
} catch (err) {}

import("../dist/es/index.js").then(({ default: run }) => {
  process.title = "openapi-to";
  console.log("-> process.argv", process.argv);
  run(process.argv);
});
