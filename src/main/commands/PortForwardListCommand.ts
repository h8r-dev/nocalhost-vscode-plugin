import * as vscode from "vscode";

import ICommand from "./ICommand";
import { PORT_FORWARD_LIST } from "./constants";
import registerCommand from "./register";
import host from "../host";
import * as nhctl from "../ctl/nhctl";
import { KubernetesResourceNode } from "../nodes/abstract/KubernetesResourceNode";

export default class PortForwardListCommand implements ICommand {
  command: string = PORT_FORWARD_LIST;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  async execCommand(node: KubernetesResourceNode) {
    if (!node) {
      host.showWarnMessage("A task is running, please try again later");
      return;
    }

    const svcProfile = await nhctl.getServiceConfig(
      node.getKubeConfigPath(),
      node.getAppName(),
      node.name,
      node.resourceType
    );

    if (!svcProfile) {
      host.showErrorMessage("not get service config");
      return;
    }

    const portForwardList = svcProfile.devPortForwardList.filter((item) => {
      if (item.role === "SYNC") {
        return false;
      }
      return true;
    });

    if (portForwardList.length < 1) {
      host.showInformationMessage("No Port Forward");
      return;
    }

    const portList = portForwardList.map((item) => {
      return `${item.localport}:${item.remoteport}(${item.status})`;
    });

    const endPort = await vscode.window.showQuickPick(portList);

    if (!endPort) {
      return;
    }

    const confirm = await host.showInformationMessage(
      `Do you want to stop port-forward ${endPort}?`,
      { modal: true },
      "Confirm"
    );

    if (confirm !== "Confirm") {
      return;
    }

    const endPosition = endPort.indexOf("(");
    await host.showProgressing(
      "Ending port-forward: " + endPort.substring(0, endPosition),
      async () => {
        await nhctl.endPortForward(
          node.getKubeConfigPath(),
          node.getAppName(),
          node.name,
          endPort.substring(0, endPosition),
          node.resourceType
        );
      }
    );
    await vscode.commands.executeCommand("Nocalhost.refresh", node);
    host.showInformationMessage(`Ended Port Forward ${endPort}`);
    host.getOutputChannel().show(true);
  }
}
