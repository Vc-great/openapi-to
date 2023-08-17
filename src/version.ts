import { execSync } from "child_process";
import chalk from "chalk";
/**
 * 比较插件的两个版本v1,v2大小
 * .e.g '3.1.7-alpha.19'
 * @param v1 { string } {major}.{minor}.{patch}-{pre-release}
 * @param v2 { string } {major}.{minor}.{patch}-{pre-release}
 * @return {number} 1大 0相等 -1小
 */
function compareVersionLatest(v1, v2) {
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

function getLocalVersion() {
  try {
    const res = execSync("npm ls openapi-to");
    const version = res.toString().split("openapi-to@")[1].split(" ")[0];
    return [undefined, version];
  } catch (e) {
    return [e, undefined];
  }
}
//查看本地全局版本
function getLocalGlobalVersion() {
  try {
    const res = execSync("npm ls openapi-to -g");
    const version = res.toString().split("openapi-to@")[1].split(" ")[0];
    return [undefined, version];
  } catch (e) {
    return [e, undefined];
  }
}

function getRemoteVersion() {
  const res = execSync("npm view openapi-to version");
  return res.toString();
}

function getVersion() {
  let [, localVersion] = getLocalVersion();
  let [, localGlobalVersion] = getLocalGlobalVersion();
  return localVersion || localGlobalVersion;
}

function message(localVersion: string, remoteVersion: string) {
  const log = chalk.hex("#ffcb6b");
  return log.bold(`
 New version! ${localVersion} → ${remoteVersion}
 Run npm install -g openapi-to to update! 
`);
}

export function updateVersionMessage() {
  const localVersion = getVersion();
  const remoteVersion = getRemoteVersion();
  const result = compareVersionLatest(localVersion, remoteVersion);

  return result === 1 ? message(localVersion, remoteVersion) : "";
}
