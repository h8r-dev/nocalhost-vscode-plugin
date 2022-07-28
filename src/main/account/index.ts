/**
 * Manage account details
 */

import * as path from "path";

import { merge } from "lodash-es";

import logger from "../utils/logger";
import {
  readFile,
  isExistSync,
  mkdir,
  writeFileAsync,
  getFilesByDir,
} from "../utils/fileUtil";
import host from "../host";
import { PLUGIN_CONFIG_ACCOUNT_DIR } from "../constants";
import { writeFileSync } from "fs";

interface AccountDetails {
  email: string;
  token: string;
}

interface ApplicationDetail {
  email: string;
  organization: string;
  application: string;
  service: string;
  action: string; // debug or run
  kubeconfig: string;
  workloadType: string;
  namespace: string;
  environment: string;
}

const TOKEN_FILE = "token.txt";
const APPLICATION_FILE = "application.json";

function recordError(errMsg: string): void {
  logger.error(errMsg);
  host.showErrorMessage(errMsg);
}

function createUserAccountDir(email: string): string {
  try {
    const accountDir = path.resolve(PLUGIN_CONFIG_ACCOUNT_DIR);
    mkdir(accountDir);

    const userAccountDir = path.resolve(accountDir, email);
    mkdir(userAccountDir);

    return userAccountDir;
  } catch (error) {
    recordError(`Create user account directory with error: ${error}`);
    return "";
  }
}

export function storeAccountToken(data: AccountDetails): void {
  if (!data.email || !data.token) {
    return;
  }

  try {
    const userAccountDir = createUserAccountDir(data.email);
    writeFileAsync(path.resolve(userAccountDir, TOKEN_FILE), data.token);
  } catch (error) {
    recordError(`Store account token with error: ${error}`);
  }
}

export async function storeApplication(data: ApplicationDetail): Promise<void> {
  try {
    const userAccountDir = createUserAccountDir(data.email);
    const appDataPath = path.resolve(userAccountDir, APPLICATION_FILE);
    let cacheData = null;

    if (isExistSync(appDataPath)) {
      cacheData = await readFile(appDataPath);
      cacheData = JSON.parse(cacheData);
    }

    // TODO: Store local associated dir.

    const appData = {
      [data.organization]: {
        name: data.organization,
        applications: [
          {
            name: data.application,
            kubeconfig: data.kubeconfig,
            services: [
              {
                name: data.service,
                action: data.action,
                workloadType: data.workloadType,
                namespace: data.namespace,
                env: data.environment,
              },
            ],
          },
        ],
      },
    };

    const resultData = cacheData ? merge(cacheData, appData) : appData;
    writeFileSync(appDataPath, JSON.stringify(resultData, null, 2));
  } catch (err) {
    recordError(`Store application data with error: ${err}`);
  }
}

// Get stored application data.
export async function getStoredApplicationData(): Promise<any> {
  try {
    const accountDir = path.resolve(PLUGIN_CONFIG_ACCOUNT_DIR);
    if (!isExistSync(accountDir)) {
      return null;
    }

    const accounts = getFilesByDir(accountDir);
    for (let account of accounts) {
      const currentAccountToken = path.resolve(accountDir, account, TOKEN_FILE);
      if (isExistSync(currentAccountToken)) {
        // Token found.
        const appDataPath = path.resolve(accountDir, account, APPLICATION_FILE);
        if (isExistSync(appDataPath)) {
          const appdata = await readFile(appDataPath);
          return JSON.parse(appdata);
        }
      }
    }
  } catch (error) {
    recordError(`Get stored application data with error: ${error}`);
  }
}

// Clear stored token when logout
export function clearStoredToken(email: string): void {
  // TODO: Clear token here
  // Just clear token file of that account dir.
}
