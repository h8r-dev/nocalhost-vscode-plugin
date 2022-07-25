/**
 * An Application created on ForkMain.
 */
import React from "react";
import { postMessage } from "../../utils/index";

interface ApplicationProps {
  app: any;
}

const ApplicationComp: React.FC<ApplicationProps> = ({ app }) => {
  // TODO: replace with real data.
  const appId = 123;
  const organizationId = 345;

  function manageApp() {
    postMessage({
      type: "manageApp",
      data: {
        // TODO: Replace with real url here.
        url: `/orgs/${organizationId}/app/${appId}`,
      },
    });
  }

  return (
    <div className="forkmain-app">
      <button title="Manage Your Application" onClick={manageApp}>
        Manage Application
      </button>
    </div>
  );
};

export default ApplicationComp;
