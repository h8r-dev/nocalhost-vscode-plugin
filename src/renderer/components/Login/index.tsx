import React from "react";
import { postMessage } from "../../utils/index";

interface LoginProps { }

const LoginComp: React.FC<LoginProps> = (props) => {
  function openForkMain() {
    postMessage({
      type: "loginForkMain",
      data: {
        url: "/sign-in?from=IDEExtension",
      },
    });
  }

  return (
    <div className="forkmain-login">
      <button
        title="Login Your ForkMain Account"
        onClick={openForkMain}
      >
        Sign In
      </button>
    </div>
  );
};

export default LoginComp;