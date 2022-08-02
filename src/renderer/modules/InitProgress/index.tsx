/**
 * Show local workspace init progress
 */

import React, { useEffect, useState } from "react";

import { createStyles, makeStyles } from "@material-ui/core";

import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import Paper from "@material-ui/core/Paper";
import Box from "@material-ui/core/Box";

const steps = [
  "Clone source code",
  "Bootstrap service",
  "Sync local workspace files",
  "Install dependencies",
  "Start debugger",
  "Ready",
];

const useStyles = makeStyles(() =>
  createStyles({
    section: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    paper: {
      width: "100%",
      height: "100%",
      borderRadius: "none",
    },
  })
);

enum progressMessage {
  CLONE_CODE = "cloneCode",
  BOOTSTRAP_SERVICE = "bootstrapService",
  SYNC_CODE = "syncCode",
  INSTALL_DEPENDENCIES = "installDependencies",
  CONNECT_DEBUGGER = "connectDebugger",
  READY = "ready",
}

const LocalWorkspaceInitProgress = () => {
  const [step, setStep] = useState(0);
  const styles = useStyles();

  function handleUpdateStep(event: MessageEvent) {
    const message: progressMessage = event.data;
    switch (message) {
      case progressMessage.CLONE_CODE:
        break;

      case progressMessage.BOOTSTRAP_SERVICE:
        break;

      case progressMessage.SYNC_CODE:
        break;

      case progressMessage.INSTALL_DEPENDENCIES:
        break;

      case progressMessage.CONNECT_DEBUGGER:
        break;

      case progressMessage.READY:
        break;

      default:
        break;
    }
  }

  // useEffect(() => {
  //   window.addEventListener('message', handleUpdateStep)
  //   return () => window.removeEventListener('message', handleUpdateStep)
  // }, [])

  return (
    <div style={{ width: "100%" }}>
      <h3 style={{ marginBottom: 30, marginTop: 30 }}>
        Show Init Progress Of Local Workspace
      </h3>
      <Stepper activeStep={step} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: 500,
          borderRadius: "none",
        }}
      >
        <Paper className={styles.paper}>
          {step === 0 && (
            <section className={styles.section}> Clone source code log</section>
          )}
          {step === 1 && (
            <section className={styles.section}>
              {" "}
              Bootstraping the service{" "}
            </section>
          )}
          {step === 2 && (
            <section className={styles.section}> Sync files...</section>
          )}
          {step === 3 && (
            <section className={styles.section}>
              {" "}
              Installing dependencies{" "}
            </section>
          )}
          {step === 4 && (
            <section className={styles.section}> Start Debugger... </section>
          )}
          {step >= 5 && (
            <section className={styles.section}>
              <p>Happy coding now!</p>
            </section>
          )}
        </Paper>
      </Box>
    </div>
  );
};

export default LocalWorkspaceInitProgress;
