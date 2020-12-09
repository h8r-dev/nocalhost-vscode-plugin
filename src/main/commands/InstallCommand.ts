import * as vscode from "vscode";
import * as path from "path";

import ICommand from "./ICommand";
import { INSTALL_APP } from "./constants";
import registerCommand from "./register";
import state from "../state";
import { AppFolderNode, NocalhostAccountNode } from "../nodes/nodeType";
import host, { Host } from "../host";
import { KUBE_CONFIG_DIR, SELECTED_APP_NAME } from "../constants";
import * as fileStore from "../store/fileStore";
import { updateAppInstallStatus } from "../api";
import * as nhctl from "../ctl/nhctl";

export default class InstallCommand implements ICommand {
  command: string = INSTALL_APP;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, true, this.execCommand.bind(this));
  }
  async execCommand(appNode: AppFolderNode) {
    state.setAppState(appNode.label, "installing", true, {
      refresh: true,
      node: appNode,
    });
    const currentKubeConfigFullpath = this.getKubeConfigPath(appNode);
    fileStore.set(SELECTED_APP_NAME, appNode.info.name);
    fileStore.set(currentKubeConfigFullpath, currentKubeConfigFullpath);
    vscode.commands.executeCommand("Nocalhost.refresh");
    // make siblings collapsis
    const siblings: (
      | AppFolderNode
      | NocalhostAccountNode
    )[] = await appNode.siblings();
    siblings.forEach((item) => {
      const node = item as AppFolderNode;
      node.collapsis();
    });

    await this.install(
      host,
      appNode.info.name,
      appNode.id,
      appNode.devSpaceId,
      appNode.info.url,
      appNode.installType,
      appNode.resourceDir
    ).finally(() => {
      state.deleteAppState(appNode.label, "installing");
      appNode.expanded();
      appNode.expandWorkloadNode();
      vscode.commands.executeCommand("Nocalhost.refresh");
    });
  }

  private async install(
    host: Host,
    appName: string,
    appId: number,
    devSpaceId: number,
    gitUrl: string,
    installType: string,
    resourceDir: string
  ) {
    host.log(`Installing application: ${appName}`, true);
    host.showInformationMessage(`Installing application: ${appName}`);
    // tips
    let values: string | undefined;
    if (["helm", "helm-repo"].includes(installType)) {
      const res = await host.showInformationMessage(
        "Do you want to specify a values.yaml?",
        { modal: true },
        "Specify One",
        "Use Default values"
      );
      if (res === "Specify One") {
        const valuesUri = await host.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          title: "Select the value file path",
        });

        if (valuesUri) {
          values = valuesUri[0].path;
        }
      }
    }
    await nhctl.install(
      host,
      appName,
      gitUrl,
      installType,
      resourceDir,
      values
    );
    await updateAppInstallStatus(appId, devSpaceId, 1);
    fileStore.set(appName, {});
    host.log(`Application ${appName} installed`, true);
    host.showInformationMessage(`Application ${appName} installed`);
  }

  private getKubeConfigPath(appNode: AppFolderNode): string {
    const { id, devSpaceId } = appNode;
    return path.resolve(KUBE_CONFIG_DIR, `${id}_${devSpaceId}_config`);
  }
}
