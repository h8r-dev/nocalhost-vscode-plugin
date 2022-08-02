import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";
import { existsSync } from "fs";

import { EXEC, SIGN_IN, RUN } from "../commands/constants";
import { NocalhostRootNode } from "../nodes/NocalhostRootNode";
import NocalhostAppProvider from "../appProvider";
import LocateWorkNodeService from "../utils/locateWorkerNode";

import { LocalCluster } from "../clusters";
import host from "../host";
import { readYaml, resolveExtensionFilePath } from "../utils/fileUtil";
import state from "../state";
import { NOCALHOST } from "../constants";
import { checkKubeconfig, IKubeconfig } from "../ctl/nhctl";
import logger from "../utils/logger";

// Forkmain Account related
import { getStoredToken, getStoredApplicationData } from "../account";
import { BaseNocalhostNode } from "../nodes/types/nodeType";

export class HomeWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "Nocalhost.Home";

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly appTreeProvider: NocalhostAppProvider
  ) {}

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

  private open_forkmain_website(path: string): void {
    const baseUrl = process.env.FORKMAIN_URL;
    host.openExternal(baseUrl + path);
  }

  // Check if account token existed.
  // TODO: validate the cached token from forkmain.com backend service.
  // If token expired, clear local cached account data: token, user profile...
  private async isLoggedin(): Promise<boolean> {
    const token = await getStoredToken();
    return token !== "";
  }

  private async getUserProfile(): Promise<any> {
    return {};
  }

  private _webviewView: vscode.WebviewView;
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
          case "init": {
            if (!this.isLoggedin()) {
              return;
            }
            const userProfile = this.getUserProfile();
            webviewView.webview.postMessage({ userProfile });
            break;
          }
          case "loginForkMain": {
            const payload = data.data ?? {};
            this.open_forkmain_website(payload.url);
            break;
          }
          case "manageApp": {
            const payload = data.data ?? {};
            this.open_forkmain_website(payload.url);
            break;
          }
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

          case "rerun": {
            const locateWorkNodeService = new LocateWorkNodeService(
              this.appTreeProvider
            );
            const targetNode: BaseNocalhostNode =
              await locateWorkNodeService.getResourceNode();

            if (!targetNode) {
              return;
            }

            // ReRun remote command in a independent terminal.
            // the operation will kill previous command running terminal.
            vscode.commands.executeCommand(RUN, targetNode, {
              command: "rerun",
            });

            // Reopen another one remote terminal, all previous terminals will be preserved.
            vscode.commands.executeCommand(EXEC, targetNode);
            break;
          }
        }
      }
    );
  }

  private async getKubeconfig(data: {
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

    return { kubeconfig, currentContext, namespace, path, strKubeconfig };
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
