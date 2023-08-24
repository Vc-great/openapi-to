// @ts-nocheck
import { execSync } from "child_process";
import chalk from "chalk";

/**
 * 比较插件的两个版本v1,v2大小.v1是否大于v2
 *
 * @param v1 { string } {major}.{minor}.{patch}-{pre-release}
 * @param v2 { string } {major}.{minor}.{patch}-{pre-release}
 * @return {number} 1大 0相等 -1小
 */
function compareVersionLatest(v1: string, v2: string) {
  if (!v1 || !v2) {
    return undefined;
  }
  const [v1Main, v1PreRelease] = v1.split("-");
  const [v2Main, v2PreRelease] = v2.split("-");

  // 比较版本主体的大小
  const v1List = v1Main.split(".");
  const v2List = v2Main.split(".");
  const len1 = v1List.length;
  const len2 = v2List.length;
  const minLen = Math.min(len1, len2);
  let curIdx = 0;
  for (curIdx; curIdx < minLen; curIdx += 1) {
    const v1CurNum = parseInt(v1List[curIdx]);
    const v2CurNum = parseInt(v2List[curIdx]);
    if (v1CurNum > v2CurNum) {
      return 1;
    } else if (v1CurNum < v2CurNum) {
      return -1;
    }
  }
  if (len1 > len2) {
    for (let lastIdx = curIdx; lastIdx < len1; lastIdx++) {
      if (parseInt(v1List[lastIdx]) != 0) {
        return 1;
      }
    }
    return 0;
  } else if (len1 < len2) {
    for (let lastIdx = curIdx; lastIdx < len2; lastIdx += 1) {
      if (parseInt(v2List[lastIdx]) != 0) {
        return -1;
      }
    }
    return 0;
  }

  // 如果存在先行版本，还需要比较先行版本的大小
  if (v1PreRelease && !v2PreRelease) {
    return 1;
  } else if (!v1PreRelease && v2PreRelease) {
    return -1;
  } else if (v1PreRelease && v2PreRelease) {
    const [gama1, time1] = v1PreRelease.split(".");
    const [gama2, time2] = v2PreRelease.split(".");
    if (gama1 > gama2) return 1;
    if (gama2 > gama1) return -1;
    if (parseInt(time1) > parseInt(time2)) return 1;
    if (parseInt(time2) > parseInt(time1)) return -1;
  }
  return 0;
}

function getRemoteVersion(): string {
  const versionsString = execSync("npm view openapi-to versions", {
    encoding: "utf-8",
  })
    .replace(/\[32m/g, "")
    .replace(/\[39m/g, "");
  const eval2 = eval;
  const version = eval2(versionsString)
    .filter((x: string) => !x.includes("-"))
    .pop();
  return version ? version : "";
}

function getVersion() {
  try {
    const versionsString = execSync("openapi -v", {
      encoding: "utf-8",
    }).replace(/\n/, "");
    return versionsString.includes("-") ? "" : versionsString;
  } catch (e) {
    return "";
  }
}

export function message(localVersion: string, remoteVersion: string) {
  const text = chalk.hex("#ffcb6b").bold(`
 New version! ${localVersion} → ${remoteVersion}
 Run npm install -g openapi-to to update! 
`);
}

/**
 * 本地版本和远程对比,判断是否需要更新
 */
export function updateVersionMessage() {
  const localVersion = getVersion();
  const remoteVersion = getRemoteVersion();
  const result = compareVersionLatest(remoteVersion, localVersion);

  return result === 1 ? message(localVersion, remoteVersion) : "";
}
