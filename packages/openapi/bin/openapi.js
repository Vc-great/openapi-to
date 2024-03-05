#!/usr/bin/env node
import { updateVersionNotifier } from "../dist/es/utils.js";

updateVersionNotifier();
import("@openapi-to/cli").then(({ run }) => {
  run(process.argv);
});
