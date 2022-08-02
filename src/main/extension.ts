import * as vscode from "vscode";
import * as nls from "vscode-nls";

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import NocalhostAppProvider from "./appProvider";

import {
  PLUGIN_TEMP_DIR,
  TMP_DEV_START_IMAGE,
  BASE_URL,
  HELM_VALUES_DIR,
  KUBE_CONFIG_DIR,
  HELM_NH_CONFIG_DIR,
  NH_CONFIG_DIR,
  PLUGIN_CONFIG_DIR,
  TMP_APP,
  TMP_KUBECONFIG_PATH,
  TMP_RESOURCE_TYPE,
  TMP_STATUS,
  TMP_STORAGE_CLASS,
  TMP_WORKLOAD,
  WELCOME_DID_SHOW,
  TMP_WORKLOAD_PATH,
  TMP_DEVSTART_APPEND_COMMAND,
  TMP_ID,
  TMP_CONTAINER,
  TMP_MODE,
  TMP_HEADER,
  TMP_DEVSPACE,
  TMP_NAMESPACE,
  NH_BIN,
  TMP_DEV_START_COMMAND,
  TMP_COMMAND,
  PLUGIN_CONFIG_PROJECTS_DIR,
  PLUGIN_CONFIG_ACCOUNT_DIR,
} from "./constants";

import host from "./host";
import NocalhostFileSystemProvider from "./fileSystemProvider";
import state from "./state";
import { START_DEV_MODE, AUTO_START_DEV_MODE } from "./commands/constants";
import initCommands from "./commands";
import { ControllerNodeApi } from "./commands/StartDevModeCommand";
import { BaseNocalhostNode, DeploymentStatus } from "./nodes/types/nodeType";
import NocalhostWebviewPanel from "./webview/NocalhostWebviewPanel";
import {
  checkVersion,
  moniterClusterState,
  ClusterDevState,
} from "./ctl/nhctl";
import logger from "./utils/logger";
import * as fileUtil from "./utils/fileUtil";
import { KubernetesResourceFolder } from "./nodes/abstract/KubernetesResourceFolder";
import messageBus, { EventType } from "./utils/messageBus";
import LocalClusterService from "./clusters/LocalCuster";
import { DevSpaceNode } from "./nodes/DevSpaceNode";
import { HomeWebViewProvider } from "./webview/HomePage";
import { unlock } from "./utils/download";
import SyncServiceCommand from "./commands/sync/SyncServiceCommand";
import { ShellExecError } from "./ctl/shell";
import { createSyncManage } from "./component/syncManage";
import { activateNocalhostDebug } from "./debug/nocalhost";

import { storeAccountToken, storeApplication } from "./account";

// The example uses the file message format.
nls.config({ messageFormat: nls.MessageFormat.file })();

const envVariables: any = {
  FORKMAIN_URL: "http://localhost",
};

if (process.env.NODE_ENV === "production") {
  envVariables.FORKMAIN_URL = "https://forkmain.com";
}

Object.keys(envVariables).forEach(
  (key: string) => (process.env[key] = envVariables[key])
);

export let appTreeView: vscode.TreeView<BaseNocalhostNode> | null | undefined;

export async function activate(context: vscode.ExtensionContext) {
  await init(context);
  let appTreeProvider = new NocalhostAppProvider(context);
  initCommands(context, appTreeProvider);

  // TODO: DO NOT DELETE, FOR: [webview integration]
  // const dataCenter: DataCenter = DataCenter.getInstance();
  // dataCenter.addListener(() => appTreeProvider.refresh());
  let homeWebViewProvider = new HomeWebViewProvider(
    context.extensionUri,
    appTreeProvider
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HomeWebViewProvider.viewType,
      homeWebViewProvider
    )
  );

  // Enter dev modes automatically.
  const handleUri = async (uri: vscode.Uri) => {
    const queryParams: URLSearchParams = new URLSearchParams(uri.query);

    if (!queryParams.get("kubeconfig")) {
      return;
    }

    vscode.commands.executeCommand(
      AUTO_START_DEV_MODE,
      {
        connectionInfo: {
          strKubeconfig: queryParams.get("kubeconfig"),
          namespace: queryParams.get("namespace"),
        },
        application: queryParams.get("application"),
        workloadType: queryParams.get("workload_type"),
        workload: queryParams.get("workload"),
        action: queryParams.get("action"),
      },
      appTreeProvider
    );

    const token = queryParams.get("token");
    const email = queryParams.get("email");

    // Maybe we should store data after developer entering dev mode successfully.

    // TODO: store associated dir.
    storeAccountToken({ email, token });

    const application: any = {
      email,
      organization: queryParams.get("organization"),
      application: queryParams.get("app"),
      service: queryParams.get("service"),
      action: queryParams.get("action"),
      kubeconfig: queryParams.get("kubeconfig"),
      workloadType: queryParams.get("workload_type"),
      namespace: queryParams.get("namespace"),
      environment: queryParams.get("env"),
    };

    storeApplication(application);

    state.setData("app", application);
  };

  let nocalhostFileSystemProvider = new NocalhostFileSystemProvider();
  appTreeView = vscode.window.createTreeView("Nocalhost", {
    treeDataProvider: appTreeProvider,
  });

  appTreeView.onDidExpandElement((e) => {
    const node = e.element;
    if (
      node instanceof KubernetesResourceFolder ||
      node instanceof DevSpaceNode
    ) {
      state.refreshFolderMap.set(node.getNodeStateId(), true);
    }
  });

  appTreeView.onDidCollapseElement((e) => {
    const node = e.element;

    const nodeStateId = node.getNodeStateId();

    Array.from(state.refreshFolderMap.keys()).forEach((id) => {
      if (id.startsWith(nodeStateId)) {
        state.refreshFolderMap.delete(id);
      }
    });
  });

  if (!host.getGlobalState(WELCOME_DID_SHOW)) {
    NocalhostWebviewPanel.open({
      url: "/welcome",
      title: "Welcome to ForkMain",
    });
    host.setGlobalState(WELCOME_DID_SHOW, true);
  }

  let isSetVisible =
    host.getGlobalState(TMP_WORKLOAD_PATH) === host.getCurrentRootPath();

  let subs = [
    host,
    appTreeView.onDidChangeVisibility((event) => {
      if (event.visible) {
        if (!isSetVisible) {
          isSetVisible = true;
          host.getOutputChannel().show(true);
        }
      }
    }),
    appTreeView,
    vscode.workspace.registerFileSystemProvider(
      "Nocalhost",
      nocalhostFileSystemProvider,
      { isReadonly: true }
    ),
    vscode.workspace.registerFileSystemProvider(
      "NocalhostRW",
      nocalhostFileSystemProvider
    ),
    vscode.window.registerUriHandler({ handleUri }),
  ];

  context.subscriptions.push(...subs);

  await vscode.commands.executeCommand(
    "setContext",
    "extensionActivated",
    true
  );

  await state.refreshTree();

  launchDevSpace();

  bindEvent();

  createSyncManage(context);
  activateNocalhostDebug(context);

  // syncDevState();
}

function syncDevState() {
  // Fetch kubeconfig and application details from stored data.

  // If no kubeconfig found, exit, no timer will be created.

  // kubeconfig: string,
  // namespace: string,
  // workloadType: string,
  // workload: string,

  setInterval(async () => {
    host.log(`Sync dev state between cluster and local workspace`, true);

    // Monitor dev state of local workspace.

    // If local workspace is under development, has that flag enabled.
    // Then check remote cluster.
    // If remote cluster is off dev state.
    // Then clear local state.

    // If remote cluster is dev state, and local workspace is off
    // That means the local state modified manually
    // You have to enter dev mode locally youself, click `reconnect` button.

    try {
      // const clusterDevState = await moniterClusterState();

      const localDevState = await localWorkspaceDevState();

      // TODO: Compare cluster state with local state.

      // Obey state from remote cluster and if local lost connection.

      // host.showErrorMessage('Local workspace lost connection to remote cluster, you can click `Reconnect` button to reconnect');
      // Notify the developer.
    } catch (err) {
      host.log(`Monitor cluster dev state with error: ${err}`);
    }
  }, 10000);
}

async function localWorkspaceDevState(): Promise<ClusterDevState> {
  // Check sync file service state

  // Check if debugger connected!

  // Check if remote terminal connected!

  return {
    isUnderDeveloping: false,
    isDebugEnabled: false,
    isRunEnabled: false,
  };
}

function bindEvent() {
  messageBus.on("refreshTree", (value) => {
    if (value.isCurrentWorkspace) {
      return;
    }

    logger.debug("refreshTree", value);

    state.startAutoRefresh(true);
  });

  messageBus.on("devStart", (value) => {
    if (value.source !== (host.getCurrentRootPath() || "")) {
      launchDevSpace();
    }
  });

  messageBus.on("endDevMode", (value) => {
    if (value.source !== (host.getCurrentRootPath() || "")) {
      host.disposeWorkload(
        value.devSpaceName,
        value.appName,
        value.workloadName
      );
    }
  });

  messageBus.on("uninstall", (value) => {
    if (value.source !== (host.getCurrentRootPath() || "")) {
      host.disposeApp(value.devSpaceName, value.appName);
    }
  });

  messageBus.on("install", (value) => {
    try {
      const data = value.value as {
        status: string;
      };
      if (data.status === "loading") {
        state.stopAutoRefresh(true);
        SyncServiceCommand.stopSyncStatus();
      } else {
        state.startAutoRefresh();
        SyncServiceCommand.checkSync();
      }
    } catch (error) {
      host.log(`MessageBus install: ${error}`, true);
    }
  });

  messageBus.on("command", (value) => {
    execCommand(value.value as any);
  });

  const commandData = host.getGlobalState(TMP_COMMAND);

  if (commandData) {
    execCommand(commandData);
  }
}

function launchDevSpace() {
  SyncServiceCommand.checkSync();

  const tmpWorkloadPath = host.getGlobalState(TMP_WORKLOAD_PATH);

  if (tmpWorkloadPath !== host.getCurrentRootPath()) {
    return;
  }

  const tmpDevspace = host.getGlobalState(TMP_DEVSPACE);
  const tmpNamespace = host.getGlobalState(TMP_NAMESPACE);
  const tmpApp = host.getGlobalState(TMP_APP);
  const tmpId = host.getGlobalState(TMP_ID);
  const tmpWorkload = host.getGlobalState(TMP_WORKLOAD);
  const tmpStatusId = host.getGlobalState(TMP_STATUS);
  const tmpResourceType = host.getGlobalState(TMP_RESOURCE_TYPE);
  const tmpKubeConfigPath = host.getGlobalState(TMP_KUBECONFIG_PATH);
  const tmpStorageClass = host.getGlobalState(TMP_STORAGE_CLASS);
  const tmpCommand = host.getGlobalState(TMP_DEV_START_COMMAND);

  const tmpDevstartAppendCommand = host.getGlobalState(
    TMP_DEVSTART_APPEND_COMMAND
  );
  const tmpContainer = host.getGlobalState(TMP_CONTAINER);
  const tmpMode = host.getGlobalState(TMP_MODE);
  const tmpHeader = host.getGlobalState(TMP_HEADER);
  const tmpImage = host.getGlobalState(TMP_DEV_START_IMAGE);

  if (tmpApp && tmpWorkload && tmpStatusId && tmpResourceType) {
    host.removeGlobalState(TMP_DEVSPACE);
    host.removeGlobalState(TMP_NAMESPACE);
    host.removeGlobalState(TMP_APP);
    host.removeGlobalState(TMP_WORKLOAD);
    host.removeGlobalState(TMP_STATUS);
    host.removeGlobalState(TMP_RESOURCE_TYPE);
    host.removeGlobalState(TMP_KUBECONFIG_PATH);
    host.removeGlobalState(TMP_WORKLOAD_PATH);
    host.removeGlobalState(TMP_DEVSTART_APPEND_COMMAND);
    host.removeGlobalState(TMP_ID);
    host.removeGlobalState(TMP_CONTAINER);
    host.removeGlobalState(TMP_STORAGE_CLASS);
    host.removeGlobalState(TMP_DEV_START_COMMAND);

    const node: ControllerNodeApi = {
      name: tmpWorkload,
      resourceType: tmpResourceType,
      getParent: () => null,
      setStatus: async (status: string): Promise<void> => {
        if (status) {
          await state.setAppState(tmpApp, `${tmpStatusId}`, status, {
            refresh: true,
            nodeStateId: tmpId,
          });
        } else {
          await state.deleteAppState(tmpApp, `${tmpStatusId}`, {
            refresh: true,
            nodeStateId: tmpId,
          });
        }
        return Promise.resolve();
      },
      getStatus: () => DeploymentStatus.developing,
      setContainer: async (container: string) => {
        if (container) {
          await state.setAppState(tmpApp, `${tmpId}_container`, container, {
            refresh: true,
            nodeStateId: tmpId,
          });
        } else {
          await state.deleteAppState(tmpApp, `${tmpId}_container`, {
            refresh: true,
            nodeStateId: tmpId,
          });
        }
        return Promise.resolve();
      },
      getContainer: () => Promise.resolve(tmpContainer),
      getKubeConfigPath: () => tmpKubeConfigPath,
      getAppName: () => tmpApp,
      getStorageClass: () => tmpStorageClass,
      getDevStartAppendCommand: () => tmpDevstartAppendCommand,
      getSpaceName: () => tmpDevspace,
      getNameSpace: () => tmpNamespace,
    };

    vscode.commands.executeCommand(START_DEV_MODE, node, {
      mode: tmpMode,
      image: tmpImage,
      command: tmpCommand,
      header: tmpHeader,
    });
  }
}

function execCommand(
  data: EventType["command"] & {
    parameter: { associate: string; status: string };
  }
) {
  const { name, parameter } = data;
  if (parameter.associate !== host.getCurrentRootPath()) {
    return;
  }

  vscode.commands.executeCommand(name, {
    getKubeConfigPath() {
      return parameter.kubeconfig;
    },
    getNameSpace() {
      return parameter.nameSpace;
    },
    getAppName() {
      return parameter.app;
    },
    name: parameter.service,
    resourceType: parameter.resourceType,
    getStatus() {
      return parameter.status;
    },
  });

  host.removeGlobalState(TMP_COMMAND);
}

export async function deactivate() {
  await unlock(() => {});
  host.dispose();
}

export async function updateServerConfigStatus() {
  await vscode.commands.executeCommand(
    "setContext",
    "serverConfig",
    host.getGlobalState(BASE_URL)
  );
}

async function init(context: vscode.ExtensionContext) {
  await host.setContext(context);
  fileUtil.mkdir(PLUGIN_CONFIG_PROJECTS_DIR);

  fileUtil.mkdir(NH_CONFIG_DIR);
  fileUtil.mkdir(PLUGIN_CONFIG_DIR);
  fileUtil.mkdir(PLUGIN_TEMP_DIR);
  fileUtil.mkdir(KUBE_CONFIG_DIR);
  fileUtil.mkdir(HELM_VALUES_DIR);
  fileUtil.mkdir(HELM_NH_CONFIG_DIR);
  fileUtil.mkdir(NH_BIN);

  // Create accounts dir.
  fileUtil.mkdir(PLUGIN_CONFIG_ACCOUNT_DIR);

  // fileStore.initConfig();
  host.setGlobalState("extensionPath", context.extensionPath);
  updateServerConfigStatus();

  await messageBus.init();
  await checkVersion();

  LocalClusterService.verifyLocalCluster();
}

process.on("exit", function (code) {
  unlock(() => {});
  logger.error("exit vscode process" + code);
});

process.on("disconnect", function () {
  unlock(() => {});
  logger.error("exit vscode process");
});
process.on("uncaughtException", (error) => {
  logger.error(`[uncaught exception] ${error.message} ${error.stack}`);
  if (error.message === "read ENOTCONN") {
    return;
  }
  if (
    error.message.includes("routines:OPENSSL_internal:WRONG_VERSION_NUMBER")
  ) {
    return;
  }
  vscode.window.showErrorMessage(error.message);
});

process.on("unhandledRejection", (error?: string | Error | any) => {
  if (error === undefined) {
    return;
  }

  function isIgnoreError(message: string) {
    if (
      message &&
      (message === "read ENOTCONN" ||
        message.includes("routines:OPENSSL_internal:WRONG_VERSION_NUMBER"))
    ) {
      return true;
    }
  }

  if (error instanceof Error || error instanceof ShellExecError) {
    if (
      host.getContext().extensionMode === vscode.ExtensionMode.Production &&
      error.stack &&
      !error.stack.includes("nocalhost.nocalhost")
    ) {
      return;
    }

    const { message } = error;

    if (!isIgnoreError(message)) {
      vscode.window.showErrorMessage(message);
    }
  } else if (error.source === "api" && error.error && error.error.code) {
    const { message } = error.error;

    if (message && !isIgnoreError(message)) {
      vscode.window.showErrorMessage(message);
    }
  }

  logger.error(`[unhandledRejection]`, error);
});
