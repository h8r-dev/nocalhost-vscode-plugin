/**
 * Execute git commands.
 */

import { spawn } from "child_process";
import { Host } from "../host";
import logger from "../utils/logger";

class Git {
  host: Host = null;
  user: string;
  project: string;
  args: string[];

  private parseGitUrl(gitUrl: string): string[] {
    if (gitUrl.startsWith("https")) {
      // https protocol
      const [scheme, host] = gitUrl.split("://");
      const [_, user, project] = host.split("/");
      return [user, project];
    }

    if (gitUrl.startsWith("git@")) {
      // Git protocol
      const [scheme, host] = gitUrl.split(":");
      const [user, project] = host.split("/");
      return [user, project.replace(/\.git$/, "")];
    }
  }

  private async cloneWithHttpsProtocol(username?: string, token?: string) {
    this.host.log("Trying Https Protocol...");

    let gitURL = `https://github.com/${this.user}/${this.project}.git`;
    if (username && token) {
      gitURL = `https://${username}:${token}@github.com/${this.user}/${this.project}.git`;
    }

    const result = await this.execComandsByArgs(["clone", gitURL]).catch(
      (err) => err
    );
    if (result === null) {
      this.host.log(`Operation: git clone ${gitURL} successfully!`);
      return true;
    }

    return false;
  }

  private async cloneWithGitProtocol() {
    this.host.log("Trying Git Protocol...");

    const gitURL = `git@github.com:${this.user}/${this.project}.git`;

    const result = await this.execComandsByArgs(["clone", gitURL]).catch(
      (err) => err
    );
    if (result === null) {
      this.host.log(`Operation: git clone ${gitURL} successfully!`);
      return true;
    }

    return false;
  }

  public async clone(
    host: Host,
    gitUrl: string,
    args: Array<string>
  ): Promise<boolean> {
    this.host = host;
    this.args = args;

    const [user, project] = this.parseGitUrl(gitUrl);
    this.user = user;
    this.project = project;

    let cloneResult: boolean = false;

    // Try https protocol
    cloneResult = await this.cloneWithHttpsProtocol();
    if (cloneResult) {
      return true;
    }

    // Try Git protocol
    cloneResult = await this.cloneWithGitProtocol();
    if (cloneResult) {
      return true;
    }

    host.showInformationMessage("You have to enter your credentials to clone the source code.");

    // Prompt window to input username && password, and use https protocol
    const username = await host.showInputBox({
      placeHolder: "Username",
      prompt: "Please input your username of GitHub",
    });

    if (!username) {
      this.host.showInformationMessage(`Cancelled`);
      return;
    }

    const token = await host.showInputBox({
      placeHolder: "GitHub Personal Access Token",
      prompt: "Please input your GitHub personal access token",
      password: true,
    });

    if (!token) {
      this.host.showInformationMessage(`Cancelled`);
      return;
    }

    cloneResult = await this.cloneWithHttpsProtocol(username, token);
    return cloneResult;
  }

  public async execComandsByArgs(args: Array<string>) {
    let argsStr = "git";
    const mergedArgs = [...args, ...this.args];
    mergedArgs.forEach((arg) => {
      argsStr += ` ${arg}`;
    });
    return this.exec(argsStr);
  }

  public async exec(command: string) {
    this.host.log(`[cmd] ${command}`, true);
    logger.info(`[cmd] ${command}`);

    return new Promise((resolve, reject) => {
      const proc = spawn(command, [], { shell: true });
      let errorStr = "";

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          this.host.showErrorMessage(`Error: ${errorStr}`);
          reject(errorStr);
        }
      });

      proc.stdout.on("data", (data) => {
        this.host.log("" + data, true);
      });

      proc.on("error", (err) => {
        this.host.showErrorMessage(`Error: ${err.message}`);
        reject(err);
      });

      proc.stderr.on("data", (data) => {
        errorStr = data + "";
        this.host.log("" + data, true);
        logger.error(`[cmd] ${command} error: ${data}`);
      });
    });
  }
}

export default new Git();
