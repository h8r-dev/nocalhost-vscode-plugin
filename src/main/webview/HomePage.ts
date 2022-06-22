import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";

import { RUN, SIGN_IN, START_DEV_MODE, DEBUG } from "../commands/constants";
import { BaseNocalhostNode } from "../nodes/types/nodeType";
import { DevSpaceNode } from "../nodes/DevSpaceNode";
import NocalhostAppProvider from "../appProvider";
import { NocalhostRootNode } from "../nodes/NocalhostRootNode";

import { LocalCluster } from "../clusters";
import host from "../host";
import { readYaml, resolveExtensionFilePath } from "../utils/fileUtil";
import state from "../state";
import { NOCALHOST } from "../constants";
import { checkKubeconfig, IKubeconfig } from "../ctl/nhctl";
import logger from "../utils/logger";
import { existsSync } from "fs";

export class HomeWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "Nocalhost.Home";

  constructor(private readonly _extensionUri: vscode.Uri) {}

  private _isRegister = false;
  private registerCommand() {
    if (this._isRegister) {
      return;
    }

    host.getContext().subscriptions.push(
      vscode.commands.registerCommand(`${NOCALHOST}.connect`, (payload) => {
        this._webviewView.webview.postMessage({
          type: "setNavTab",
          payload,
        });
      })
    );

    this._isRegister = true;
  }

  private _webviewView: vscode.WebviewView;

  /**
   * Handle: Add_Cluster -> Locate workload node in tree view -> Enter dev mode | Enter debug mode
   */
  public handleDevelopApp(
    data: any,
    appTreeProvider: NocalhostAppProvider,
    appTreeView: vscode.TreeView<BaseNocalhostNode>
  ) {
    const { connectionInfo, application, workloadType, workload, action } =
      data;

    host.showProgressing("Adding cluster ...", async () => {
      let { kubeconfig, clusterName } = await this.getKubeconfig(
        connectionInfo
      );

      let newLocalCluster = await LocalCluster.appendLocalClusterByKubeConfig(
        kubeconfig
      );

      if (newLocalCluster) {
        await LocalCluster.getLocalClusterRootNode(newLocalCluster);

        const node = state.getNode(NOCALHOST) as NocalhostRootNode;

        // Add Cluster
        node && (await node.addCluster(newLocalCluster));

        // Refresh UI
        await state.refreshTree(true);

        vscode.window.showInformationMessage("Success");
      }

      // Locate workload node.
      const targetWorkloadNode: BaseNocalhostNode = await host.withProgress(
        {
          title: `Entering ${action} mode...`,
          cancellable: true,
        },
        async (_, token) => {
          const searchPath = [
            clusterName,
            connectionInfo.namespace,
            application,
            "Workloads",
            workloadType + "s",
            workload,
          ];
          return searchPath.reduce(async (parent, label) => {
            if (token.isCancellationRequested) {
              return null;
            }

            const children = await (await parent).getChildren();

            const child = children.find((item: any) => {
              if (item instanceof DevSpaceNode) {
                return item.info.namespace === label.toLowerCase();
              }
              return item.label.toLowerCase() === label.toLowerCase();
            });

            return child;
          }, Promise.resolve(appTreeProvider as Pick<BaseNocalhostNode, "getChildren">));
        }
      );

      // Reveal node in tree view.
      const nodeStateId = state.getNode(targetWorkloadNode.getNodeStateId());
      await appTreeView.reveal(nodeStateId);

      switch (action) {
        case "run":
          vscode.commands.executeCommand(RUN, targetWorkloadNode); // Enter dev mode.
          break;

        case "debug":
          vscode.commands.executeCommand(DEBUG, targetWorkloadNode); // Enter debug mode.
          break;

        default:
          break;
      }
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._webviewView = webviewView;
    this.registerCommand();

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (data: { data: any; type: string }) => {
        const { type } = data;
        switch (type) {
          case "connectServer": {
            vscode.commands.executeCommand(SIGN_IN, data.data);
            break;
          }
          case "parseKubeConfig":
          case "selectKubeConfig": {
            const payload = data.data ?? {};
            let { strKubeconfig, path: localPath } = payload;

            if (type === "selectKubeConfig" && !localPath) {
              const kubeConfigUri = await host.showSelectFileDialog(
                "select your kubeConfig"
              );
              if (!kubeConfigUri || kubeConfigUri.length < 1) {
                return;
              }
              localPath = kubeConfigUri[0].fsPath;
            }

            const { kubeconfig } = await this.getKubeconfig({
              path: localPath,
              strKubeconfig,
            });

            webviewView.webview.postMessage({
              type,
              payload: {
                ...payload,
                path: localPath,
                strKubeconfig,
                kubeconfig,
              },
            });
            break;
          }

          case "initKubePath": {
            const payload = data.data ?? {};

            let { path: defaultKubePath } = payload;

            let kubeconfig: IKubeconfig;
            if (defaultKubePath) {
              kubeconfig = await readYaml<IKubeconfig>(defaultKubePath);
            } else {
              defaultKubePath = path.resolve(os.homedir(), ".kube", "config");

              if (existsSync(defaultKubePath)) {
                kubeconfig = await readYaml<IKubeconfig>(defaultKubePath);
              } else {
                defaultKubePath = null;
              }
            }

            webviewView.webview.postMessage({
              type,
              payload: {
                ...payload,
                path: defaultKubePath,
                kubeconfig,
              },
            });
            break;
          }

          case "checkKubeconfig":
            this.checkKubeconfig(type, data.data, webviewView);
            break;

          case "local": {
            host.showProgressing("Adding ...", async () => {
              let { kubeconfig } = await this.getKubeconfig(data.data);

              let newLocalCluster =
                await LocalCluster.appendLocalClusterByKubeConfig(kubeconfig);

              if (newLocalCluster) {
                await LocalCluster.getLocalClusterRootNode(newLocalCluster);

                const node = state.getNode(NOCALHOST) as NocalhostRootNode;

                node && (await node.addCluster(newLocalCluster));

                await state.refreshTree(true);

                vscode.window.showInformationMessage("Success");
              }
            });
            break;
          }
        }
      }
    );
  }

  public async getKubeconfig(data: {
    currentContext?: string;
    strKubeconfig?: string;
    namespace?: string;
    path?: string;
  }) {
    const { path, strKubeconfig, currentContext, namespace } = data;
    let kubeconfig: IKubeconfig;

    if (path) {
      kubeconfig = await readYaml<IKubeconfig>(path);
    } else if (strKubeconfig) {
      try {
        kubeconfig = yaml.parse(strKubeconfig);
      } catch (error) {
        logger.error("checkKubeconfig yaml parse", error);
      }
    }

    let clusterName = "";
    if (strKubeconfig) {
      const parsedKubeconfig = yaml.parse(strKubeconfig);
      clusterName = parsedKubeconfig.clusters[0].name;
    }

    if (kubeconfig) {
      if (namespace) {
        const context = kubeconfig.contexts?.find(
          (context) => context.name === currentContext
        )?.context;

        if (context) {
          context.namespace = namespace;
        }
      }
      if (currentContext) {
        kubeconfig["current-context"] = currentContext;
      }
    }

    return {
      kubeconfig,
      currentContext,
      namespace,
      path,
      strKubeconfig,
      clusterName,
    };
  }

  private async checkKubeconfig(
    type: string,
    data: any,
    webviewView: vscode.WebviewView
  ) {
    let { kubeconfig, currentContext, path, strKubeconfig } =
      await this.getKubeconfig(data);

    let str: string = strKubeconfig;

    if (kubeconfig) {
      str = yaml.stringify(kubeconfig);
    }

    let payload = await checkKubeconfig({ path, str }, currentContext);

    webviewView.webview.postMessage({
      type,
      payload,
    });
  }

  private getCssPath(name: string) {
    return this._webviewView.webview.asWebviewUri(
      resolveExtensionFilePath("dist", "static", "home", name)
    );
  }
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const bundlePath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "home.js")
    );

    // Do the same for the stylesheet.
    const styleResetUri = this.getCssPath("reset.css");

    const styleVSCodeUri = this.getCssPath("vscode.css");

    const styleMainUri = this.getCssPath("main.css");

    return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">

			<meta name="viewport" content="width=device-width, initial-scale=1.0, min-width=480">

			<link href="${styleResetUri}" rel="stylesheet">
			<link href="${styleVSCodeUri}" rel="stylesheet">
			<link href="${styleMainUri}" rel="stylesheet">
			
			<title>Home</title>
		</head>
		<body>
			<div id="root"></div>
			<script type="module" src="${bundlePath}"></script>
		</body>
		</html>`;
  }
}
