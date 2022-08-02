/**
 * Support enter multi dev modes automatically.
 */

import * as vscode from "vscode";
import * as yaml from "yaml";

import host from "../host";
import NocalhostAppProvider from "../appProvider";
import { LocalCluster } from "../clusters";
import { LocalClusterNode } from "../clusters/LocalCuster";
import state from "../state";
import { NOCALHOST } from "../constants";
import { NocalhostRootNode } from "../nodes/NocalhostRootNode";
import { BaseNocalhostNode } from "../nodes/types/nodeType";
import { DevSpaceNode } from "../nodes/DevSpaceNode";
import { RUN, DEBUG, END_DEV_MODE } from "../commands/constants";
import { IKubeconfig } from "../ctl/nhctl";
import logger from "../utils/logger";
import NocalhostWebviewPanel from "../webview/NocalhostWebviewPanel";

import ICommand from "./ICommand";
import { AUTO_START_DEV_MODE } from "./constants";
import registerCommand from "./register";

type ConnectionInfoType = {
  strKubeconfig: string;
  namespace: string;
};

type DataType = {
  connectionInfo: ConnectionInfoType;
  application: string;
  workloadType:
    | "Deployment"
    | "StatefuleSet"
    | "DaemonSet"
    | "Job"
    | "CronJob"
    | "Pod";
  workload: string;
  action: "run" | "debug" | "stop";
};

export default class AutoStartDevModeCommand implements ICommand {
  command: string = AUTO_START_DEV_MODE;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    registerCommand(context, this.command, true, this.execCommand.bind(this));
  }

  async execCommand(data: DataType, appTreeProvider?: NocalhostAppProvider) {
    const { connectionInfo, application, workloadType, workload, action } =
      data;

    let { kubeconfig, clusterName } = await this.getKubeconfig(connectionInfo);

    // Locate workload node in tree view.
    const searchPath = [
      clusterName,
      connectionInfo.namespace,
      application,
      "Workloads",
      workloadType + "s",
      workload,
    ];

    if (action === "stop") {
      host.showProgressing("Stopping local workspace...", async () => {
        const rootNode = Promise.resolve(
          appTreeProvider as Pick<BaseNocalhostNode, "getChildren">
        );
        const targetWorkloadNode: BaseNocalhostNode =
          await this.locateWorkerloadNode(rootNode, searchPath);

        // Stop local workspace.
        this.handleActions(action, targetWorkloadNode);
      });
    } else {
      host.showProgressing("Initializing local workspace...", async () => {
        let newLocalCluster = await LocalCluster.appendLocalClusterByKubeConfig(
          kubeconfig
        );

        if (newLocalCluster) {
          await this.addNewCluster(newLocalCluster);
        }

        NocalhostWebviewPanel.open({
          url: "/progress",
          title: "Show init progress of local workspace",
        });

        const rootNode = Promise.resolve(
          appTreeProvider as Pick<BaseNocalhostNode, "getChildren">
        );
        const targetWorkloadNode: BaseNocalhostNode =
          await this.locateWorkerloadNode(rootNode, searchPath);

        if (!targetWorkloadNode) {
          host.log("Failed to find workload node, exit.", true);
          await host.showErrorMessage("Failed to find workload node, exit.");
          return;
        }

        // Enter different dev modes based on action provided.
        this.handleActions(action, targetWorkloadNode);
      });
    }
  }

  private handleActions(
    action: "debug" | "run" | "stop",
    targetWorkloadNode: BaseNocalhostNode
  ): void {
    switch (action) {
      case "run":
        vscode.commands.executeCommand(RUN, targetWorkloadNode, {
          isAutoMode: true,
        }); // Enter dev mode.
        break;

      case "debug":
        vscode.commands.executeCommand(DEBUG, targetWorkloadNode, {
          isAutoMode: true,
        }); // Enter debug mode.
        break;

      case "stop":
        vscode.commands.executeCommand(END_DEV_MODE, targetWorkloadNode, {
          isAutoMode: true,
        }); // End dev mode.
        break;

      default:
        break;
    }
  }

  private async addNewCluster(clusterNode: LocalClusterNode) {
    await LocalCluster.getLocalClusterRootNode(clusterNode);

    const node = state.getNode(NOCALHOST) as NocalhostRootNode;

    // Add Cluster
    node && (await node.addCluster(clusterNode));

    // Refresh UI
    await state.refreshTree(true);

    vscode.window.showInformationMessage("Success add cluster");
  }

  private async locateWorkerloadNode(rootNode: any, searchPath: string[]) {
    return searchPath.reduce(async (parent, label) => {
      const children = await (await parent).getChildren();

      const child = children.find((item: any) => {
        if (item instanceof DevSpaceNode) {
          return item.info.namespace === label.toLowerCase();
        }
        return item.label.toLowerCase() === label.toLowerCase();
      });

      return child;
    }, rootNode);
  }

  private async getKubeconfig(data: {
    strKubeconfig?: string;
    namespace?: string;
  }) {
    const { strKubeconfig } = data;
    let kubeconfig;

    try {
      kubeconfig = yaml.parse(strKubeconfig);
    } catch (error) {
      logger.error("getKubeconfig yaml parse", error);
    }

    const clusterName = kubeconfig?.clusters[0]?.name;

    return {
      kubeconfig: kubeconfig as IKubeconfig,
      clusterName,
    };
  }
}
