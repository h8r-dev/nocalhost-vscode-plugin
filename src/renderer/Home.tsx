import React, { useEffect, useState } from "react";
// import { getState, setState } from "./utils/index";

import LoginComp from "./components/Login";
import ApplicationComp from "./components/Application";
import AccountComp from "./components/Account";

export default function Home() {
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      const message = event.data;
      setUserProfile(message.userProfile);
    });
  }, []);

  return <div></div>;

  // return (
  //   <div>
  //     {userProfile ? (
  //       <div>
  //         <AccountComp profile={userProfile} />
  //         <ApplicationComp app={{ name: "abc123" }} />
  //       </div>
  //     ) : (
  //       <LoginComp />
  //     )}
  //   </div>
  // );
}
