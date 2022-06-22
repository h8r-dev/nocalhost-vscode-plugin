/**
 * Support enter multi dev modes automatically.
 */

import * as vscode from "vscode";
import * as yaml from "yaml";

import host from "../host";
import { appTreeView } from "../extension";
import NocalhostAppProvider from "../appProvider";
import { LocalCluster } from "../clusters";
import state from "../state";
import { NOCALHOST } from "../constants";
import { NocalhostRootNode } from "../nodes/NocalhostRootNode";
import { BaseNocalhostNode } from "../nodes/types/nodeType";
import { DevSpaceNode } from "../nodes/DevSpaceNode";
import { RUN, DEBUG } from "../commands/constants";
import { IKubeconfig } from "../ctl/nhctl";
import logger from "../utils/logger";

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
  action: "run" | "debug";
};

export default class AutoStartDevModeCommand implements ICommand {
  command: string = AUTO_START_DEV_MODE;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    registerCommand(context, this.command, true, this.execCommand.bind(this));
  }

  async execCommand(data: DataType, appTreeProvider?: NocalhostAppProvider) {
    const {
      connectionInfo, application, workloadType, workload, action,
    } = data;

    host.showProgressing("Adding cluster...", async () => {
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

        vscode.window.showInformationMessage("Success add cluster");
      }

      // Locate workload node in tree view.
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
          vscode.commands.executeCommand(RUN, targetWorkloadNode, {
            isAutoMode: true,
          }); // Enter dev mode.
          break;

        case "debug":
          vscode.commands.executeCommand(DEBUG, targetWorkloadNode, {
            isAutoMode: true,
          }); // Enter debug mode.
          break;

        default:
          break;
      }
    });
  }

  private async getKubeconfig(data: {
    strKubeconfig?: string;
    namespace?: string;
  }) {
    const { strKubeconfig, namespace } = data;
    let kubeconfig;

    try {
      kubeconfig = yaml.parse(strKubeconfig);
    } catch (error) {
      logger.error("getKubeconfig yaml parse", error);
    }

    const clusterName = kubeconfig.clusters[0].name;

    return {
      kubeconfig: kubeconfig as IKubeconfig,
      clusterName,
    };
  }
}
