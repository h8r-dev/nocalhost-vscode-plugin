import React from "react";

const Welcome: React.FC = () => {
  return (
    <>
      <article className="markdown-body">
        <h2 className="atx" id="welcome-to-nocalhost">
          Welcome to ForkMain
        </h2>
        <p>
          ForkMain is an open-source IDE plugin for cloud-native applications
          development:
        </p>
        <p>
          Build, test and debug applications directly inside Kubernetes IDE
          Support : providing the same debugging and developing experience
          you're used in the IDE even in the remote Kubernetes cluster.
        </p>
        <p>
          Developing with instant file synchronization: instantly sync your code
          change to remote container without rebuilding images or restarting
          containers.
        </p>
        <h3 className="atx" id="how-to-use">
          QuickStart
        </h3>
        <p>Click <em>LogIn</em> button, then you will be redirected to dashboard of ForkMain website.</p>
        <p>Next, click <em>Debug</em> button of your application panel to begin the travel.</p>
      </article>
    </>
  );
};

export default Welcome;
