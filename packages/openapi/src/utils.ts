import updateNotifier from "update-notifier";

import packageJson from "../package.json" assert { type: "json" };

export function updateVersionNotifier() {
  updateNotifier({ pkg: packageJson }).notify();
}
