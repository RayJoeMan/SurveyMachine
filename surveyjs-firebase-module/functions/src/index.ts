import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "us-central1",
  maxInstances: 20,
  concurrency: 40,
  timeoutSeconds: 60,
  memory: "256MiB",
});

export { closeSurveyV1, publishSurveyV1, upsertSurveyV1 } from "./surveys/admin.callables";
export { saveSurveyProgressV1, submitSurveyResponseV1 } from "./surveys/respondent.callables";
export { createSurveyExportV1 } from "./reporting/export.callable";
export { updateSurveySummaryV1 } from "./reporting/response.trigger";
