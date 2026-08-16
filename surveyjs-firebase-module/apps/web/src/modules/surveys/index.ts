export const surveyModule = {
  id: "surveys",
  version: "1.0.0",
  navigation: {
    label: "Surveys",
    adminPath: "/admin",
  },
  publicRoutePattern: "/s/:publicSurveyId",
  featureEntitlementPath: (orgId: string) => `organizations/${orgId}/moduleEntitlements/surveys`,
} as const;

export { TakeSurveyPage } from "./routes/TakeSurveyPage";
