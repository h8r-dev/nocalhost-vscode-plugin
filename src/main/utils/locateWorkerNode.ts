/**
 * Locate worker node, recognized from current working dir.
 *
 * if current working dir associated to a service, then locate the node in k8s resource tree.
 */

import assert = require("assert");
import * as vscode from "vscode";

import NocalhostAppProvider from "../appProvider";
import { DISASSOCIATE_ASSOCIATE } from "../component/syncManage";
import { Associate, associateQuery } from "../ctl/nhctl";
import host from "../host";
import { DevSpaceNode } from "../nodes/DevSpaceNode";
import { BaseNocalhostNode } from "../nodes/types/nodeType";
import logger from "./logger";

export default class LocateWorkNodeService {
  private appTreeProvider: NocalhostAppProvider;

  constructor(treeProvider: NocalhostAppProvider) {
    this.appTreeProvider = treeProvider;
  }

  async getResourceNode(): Promise<BaseNocalhostNode | undefined> {
    const associate = await this.getAssociate();
    const {
      svc_pack: { svc, svc_type, app, ns },
      server,
    } = associate;

    const child: BaseNocalhostNode = await host.withProgress(
      {
        title: "Geting workder node",
      },
      async (_, token) => {
        return [
          server,
          ns,
          app === "default.application" ? "default" : app,
          "Workloads",
          svc_type + "s",
          svc,
        ]
          .reduce(async (parent, label) => {
            if (token.isCancellationRequested) {
              return null;
            }

            const children = await (await parent).getChildren();

            const child = children.find((item) => {
              if (item instanceof DevSpaceNode) {
                return item.info.namespace === label.toLowerCase();
              }

              return item.label.toLowerCase() === label.toLowerCase();
            });

            return child;
          }, Promise.resolve(this.appTreeProvider as Pick<BaseNocalhostNode, "getChildren">))
          .catch((error) => {
            logger.error("getResourceNode", error);

            this.disassociate(associate);

            return null;
          });
      }
    );

    if (!child) {
      this.disassociate(associate);
      return;
    }

    return child;
  }

  async disassociate(associate: Associate.QueryResult) {
    const result = await host.showErrorMessage(
      "Failed to get work node, whether to disassociate the workload? ",
      "Disassociate",
      "Cancel"
    );

    if (result === "Disassociate") {
      vscode.commands.executeCommand(DISASSOCIATE_ASSOCIATE, {
        associate,
        currentPath: host.getCurrentRootPath(),
      });
    }
  }

  async getAssociate() {
    const queryResult = (await associateQuery({
      current: true,
    })) as Associate.QueryResult;

    assert(queryResult, "Please open your local workspace directory firstly!");

    return queryResult;
  }
}
