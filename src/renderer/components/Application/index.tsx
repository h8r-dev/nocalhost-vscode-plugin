/**
 * An Application created on ForkMain.
 */
import React from "react";
import { postMessage } from "../../utils/index";
import Divider from "@material-ui/core/Divider";

interface ApplicationProps {
  app: any;
}

const ApplicationComp: React.FC<ApplicationProps> = ({ app }) => {
  function reconnect() {
    postMessage({
      type: "rerun",
      data: {},
    });
  }

  function openTerminal() {
    postMessage({
      type: "openTerminal",
      data: {},
    });
  }

  function portForward() {
    postMessage({
      type: "portForward",
      data: {},
    });
  }

  function remoteDebug() {
    postMessage({
      type: "remoteDebug",
      data: {},
    });
  }

  function stopDevMode() {
    postMessage({
      type: "stopDevMode",
      data: {},
    });
  }

  return (
    <div className="forkmain-app">
      <div style={{ display: "flex", paddingTop: 10, paddingBottom: 10 }}>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Reconnect to remote workspace"
          onClick={reconnect}
        >
          Run
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Debug the service with remote debugger"
          onClick={remoteDebug}
        >
          Debug
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
            backgroundColor: "#b22a00",
          }}
          title="Stop the dev mode"
          onClick={stopDevMode}
        >
          Stop
        </button>
      </div>
      <Divider />
      <div style={{ display: "flex", paddingTop: 10, paddingBottom: 10 }}>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Open another remote terminal"
          onClick={openTerminal}
        >
          New Terminal
        </button>
        <button
          style={{
            width: 100,
            marginLeft: 20,
          }}
          title="Port Forward"
          onClick={portForward}
        >
          Port Forward
        </button>
      </div>
    </div>
  );
};

export default ApplicationComp;
