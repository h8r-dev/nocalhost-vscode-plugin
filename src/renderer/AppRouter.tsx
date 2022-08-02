/**
 * Main webview render page.
 */

import React from "react";
import { HashRouter, Route, Switch, Redirect } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./modules/Landing";
import Welcome from "./modules/Welcome";
import Logs from "./modules/Logs";
import InitProgress from "./modules/InitProgress";

const AppRouter: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Switch>
          <Route path="/" exact>
            <Redirect to="/landing" />
          </Route>
          <Route path="/landing" exact>
            <Landing />
          </Route>
          <Route path="/welcome" exact>
            <Welcome />
          </Route>
          <Route path="/logs" exact>
            <Logs />
          </Route>
          <Route path="/progress" exact>
            <InitProgress />
          </Route>
        </Switch>
      </Layout>
    </HashRouter>
  );
};

export default AppRouter;
