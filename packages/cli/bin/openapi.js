#!/usr/bin/env node
try {
  require("source-map-support").install({
    handleUncaughtExceptions: false,
  });
} catch (err) {}

import("../dist/es/index.js").then(({ default: run }) => {
  process.title = "openapi-to";
  run(process.argv);
});
