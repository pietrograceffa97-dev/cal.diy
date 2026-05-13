// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://d511dc1cdd1066eb0255f83c6e403daf@o4511366814040064.ingest.de.sentry.io/4511366827671632",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Tag every event with the PM Hub project that owns this deploy.
  // The PM Hub webhook reads this tag to attribute incoming Sentry
  // issues to the right project's Step 8 monitoring window.
  // `PMHUB_PROJECT_ID` is set as a Vercel env var per deploy.
  beforeSend(event) {
    if (process.env.PMHUB_PROJECT_ID) {
      event.tags = {
        ...event.tags,
        pmhub_project: process.env.PMHUB_PROJECT_ID,
      };
    }
    return event;
  },
});
