/**
 * A service of an application, such as frontend, backend or microservices.
 */

import React from "react";
import { postMessage } from "../../utils/index";

interface ServiceProps {
  service: any;
}

const ServiceComp: React.FC<ServiceProps> = ({ service }) => {
  // TODO: replace with real data.
  const name = "frokmain-frontend";
  const status = "Running";

  function manageApp() {
    postMessage({
      type: "manageApp",
      data: {
        // TODO: Replace with real url here.
        url: `https://forkmain.com/orgs/${organizationId}/app/${appId}`,
      },
    });
  }

  return (
    <div className="forkmain-service">
      <span className="service-name">{name}</span>
      <span className="service-status">{status}</span>
    </div>
  );
};

export default ServiceComp;
