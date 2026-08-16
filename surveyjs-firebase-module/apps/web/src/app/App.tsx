import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { LandingPage } from "@/modules/surveys/routes/LandingPage";
import { LoadingState } from "@/shared/AsyncState";
import { NotFoundPage } from "@/shared/NotFoundPage";

const AdminHomePage = lazy(() =>
  import("@/modules/admin/routes/AdminHomePage").then((module) => ({
    default: module.AdminHomePage,
  })),
);
const LoginPage = lazy(() =>
  import("@/modules/admin/routes/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const ReportPage = lazy(() =>
  import("@/modules/admin/routes/ReportPage").then((module) => ({ default: module.ReportPage })),
);
const SurveyEditorPage = lazy(() =>
  import("@/modules/admin/routes/SurveyEditorPage").then((module) => ({
    default: module.SurveyEditorPage,
  })),
);
const SurveyCompletePage = lazy(() =>
  import("@/modules/surveys/routes/SurveyCompletePage").then((module) => ({
    default: module.SurveyCompletePage,
  })),
);
const TakeSurveyPage = lazy(() =>
  import("@/modules/surveys/routes/TakeSurveyPage").then((module) => ({
    default: module.TakeSurveyPage,
  })),
);

export function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading page…" />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/s/:publicSurveyId" element={<TakeSurveyPage />} />
        <Route path="/thanks/:publicSurveyId" element={<SurveyCompletePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/surveys/new" element={<SurveyEditorPage />} />
        <Route path="/admin/surveys/:surveyId/edit" element={<SurveyEditorPage />} />
        <Route path="/admin/surveys/:surveyId/report" element={<ReportPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
