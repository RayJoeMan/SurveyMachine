import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { PublicSurvey } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { SurveyRunner } from "@/modules/surveys/components/SurveyRunner";
import {
  getPublicSurvey,
  SurveyUnavailableError,
} from "@/modules/surveys/data/publicSurvey.repository";
import { LoadingState, MessageState } from "@/shared/AsyncState";

type LoadState =
  | { status: "loading"; surveyKey: string }
  | { status: "ready"; surveyKey: string; survey: PublicSurvey }
  | { status: "missing"; surveyKey: string }
  | { status: "unavailable"; surveyKey: string }
  | { status: "error"; surveyKey: string };

export function TakeSurveyPage() {
  const { publicSurveyId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>({
    status: "loading",
    surveyKey: publicSurveyId,
  });

  useEffect(() => {
    let active = true;
    void getPublicSurvey(publicSurveyId)
      .then((survey) => {
        if (!active) return;
        setState(
          survey
            ? { status: "ready", surveyKey: publicSurveyId, survey }
            : { status: "missing", surveyKey: publicSurveyId },
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Survey load failed", error);
        setState(
          error instanceof SurveyUnavailableError
            ? { status: "unavailable", surveyKey: publicSurveyId }
            : { status: "error", surveyKey: publicSurveyId },
        );
      });
    return () => {
      active = false;
    };
  }, [publicSurveyId]);

  if (state.surveyKey !== publicSurveyId || state.status === "loading" || authLoading) {
    return <LoadingState label="Loading survey…" />;
  }
  if (state.status === "missing") {
    return (
      <MessageState title="Survey not found">
        <p>Check the link or ask the survey organizer for a current URL.</p>
      </MessageState>
    );
  }
  if (state.status === "unavailable") {
    return (
      <MessageState title="Survey unavailable">
        <p>This survey is disabled, private, or no longer available.</p>
      </MessageState>
    );
  }
  if (state.status === "error") {
    return (
      <MessageState title="We could not load the survey" tone="error">
        <p>
          Check your connection and refresh the page. Your organizer can also verify the survey
          link.
        </p>
      </MessageState>
    );
  }
  if (state.survey.status === "closed") {
    return (
      <MessageState title="This survey is closed">
        <p>Responses are no longer being accepted.</p>
      </MessageState>
    );
  }
  if (state.survey.settings.requireAuthentication && !user) {
    return (
      <MessageState title="Sign in required">
        <p>This survey accepts responses only from signed-in participants.</p>
        <Link
          className="button"
          to={`/login?returnTo=${encodeURIComponent(`/s/${publicSurveyId}`)}`}
        >
          Sign in
        </Link>
      </MessageState>
    );
  }

  return <SurveyRunner publicSurvey={state.survey} />;
}
