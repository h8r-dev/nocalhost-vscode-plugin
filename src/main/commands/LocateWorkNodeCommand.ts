import * as vscode from "vscode";

import NocalhostAppProvider from "../appProvider";
import { appTreeView } from "../extension";
import state from "../state";

import LocateWorkNodeService from "../utils/locateWorkerNode";

export default class LocateWorkNodeCommand {
  private workloadNodeLocater: LocateWorkNodeService;

  constructor(
    context: vscode.ExtensionContext,
    private appTreeProvider: NocalhostAppProvider
  ) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "Nocalhost.LocateWorkNode",
        this.getResourceNode.bind(this)
      )
    );

    this.workloadNodeLocater = new LocateWorkNodeService(this.appTreeProvider);
  }

  async getResourceNode() {
    const child = await this.workloadNodeLocater.getResourceNode();
    if (!child) {
      return;
    }
    const node = state.getNode(child.getNodeStateId());
    await appTreeView.reveal(node);
  }
}
