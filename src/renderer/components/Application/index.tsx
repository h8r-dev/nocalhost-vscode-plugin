/**
 * An Application created on ForkMain.
 */
import React from "react";
import { postMessage } from "../../utils/index";

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

  return (
    <div className="forkmain-app">
      <button title="Reconnect to remote workspace" onClick={reconnect}>
        Rerun
      </button>
    </div>
  );

  // return (
  //   <div className="forkmain-app">
  //     <button title="Manage Your Application" onClick={manageApp}>
  //       Manage Application
  //     </button>
  //   </div>
  // );
};

export default ApplicationComp;
