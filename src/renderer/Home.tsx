import React, { useState } from "react";
import { getState, setState } from "./utils/index";
import i18n from "./i18n";

import LoginComp from "./components/Login";

const STATE_KEY = "navTab";

export default function Home() {
  const [navTab, setNavTab] = useState<string>(
    getState<string>(STATE_KEY) || "local"
  );

  const handleChange = (newValue: string) => {
    setNavTab(newValue);
    setState(STATE_KEY, newValue);
  };

  return (
    <div>
      <LoginComp />
    </div>
  );
}
