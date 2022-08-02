import React, { useEffect, useState } from "react";
// import { getState, setState } from "./utils/index";

import { postMessage } from "./utils/index";

import LoginComp from "./components/Login";
import ApplicationComp from "./components/Application";
import AccountComp from "./components/Account";

export default function Home() {
  const [userProfile, setUserProfile] = useState(null);

  function handleMessage(event: MessageEvent) {
    const message = event.data;
    setUserProfile(message.userProfile);
  }

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    postMessage({ type: "init" });
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div>
      {userProfile ? (
        <div>
          <AccountComp profile={userProfile} />
          <ApplicationComp app={{ name: "abc123" }} />
        </div>
      ) : (
        <LoginComp />
      )}
    </div>
  );
}
