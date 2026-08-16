import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import type { PublicSurvey } from "@/contracts";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { saveSurveyProgress, submitSurveyResponse } from "@/modules/surveys/data/responses.api";
import {
  clearLocalSurveySession,
  collectResponseMetadata,
  getOrCreateSurveySession,
  loadLocalAnswers,
  saveLocalAnswers,
} from "@/modules/surveys/domain/session";

type SubmissionState = "answering" | "submitting" | "failed";

export function SurveyRunner({ publicSurvey }: { publicSurvey: PublicSurvey }) {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const session = useMemo(
    () => getOrCreateSurveySession(publicSurvey.publicSurveyId),
    [publicSurvey.publicSurveyId],
  );
  const metadata = useMemo(() => collectResponseMetadata(), []);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("answering");
  const [submissionError, setSubmissionError] = useState("");
  const lastAnswers = useRef<Record<string, unknown>>({});

  const model = useMemo(() => {
    const survey = new Model(publicSurvey.schema);
    survey.locale = publicSurvey.settings.locale;
    survey.showCompletedPage = false;
    survey.data = loadLocalAnswers(publicSurvey.publicSurveyId);
    return survey;
  }, [publicSurvey]);

  const submit = useCallback(
    async (answers: Record<string, unknown>) => {
      lastAnswers.current = answers;
      if (!navigator.onLine) {
        saveLocalAnswers(publicSurvey.publicSurveyId, answers);
        setSubmissionState("failed");
        setSubmissionError(
          "You are offline. Your answers are saved on this device; reconnect and retry.",
        );
        return;
      }

      setSubmissionState("submitting");
      setSubmissionError("");
      try {
        await submitSurveyResponse({
          publicSurveyId: publicSurvey.publicSurveyId,
          clientSubmissionId: session.clientSubmissionId,
          answers,
          startedAt: session.startedAt,
          completedAt: new Date().toISOString(),
          metadata,
        });
        clearLocalSurveySession(publicSurvey.publicSurveyId);
        navigate(`/thanks/${publicSurvey.publicSurveyId}`, { replace: true });
      } catch (error) {
        console.error("Survey submission failed", error);
        saveLocalAnswers(publicSurvey.publicSurveyId, answers);
        setSubmissionState("failed");
        setSubmissionError(
          "We could not submit your response. Your answers remain saved on this device. Please retry.",
        );
      }
    },
    [metadata, navigate, publicSurvey.publicSurveyId, session],
  );

  useEffect(() => {
    let progressTimer: ReturnType<typeof setTimeout> | undefined;

    const persistDraft = (sender: Model) => {
      const answers = sender.data as Record<string, unknown>;
      lastAnswers.current = answers;
      saveLocalAnswers(publicSurvey.publicSurveyId, answers);

      if (!publicSurvey.settings.saveProgress || !navigator.onLine) return;
      clearTimeout(progressTimer);
      progressTimer = setTimeout(() => {
        void saveSurveyProgress({
          publicSurveyId: publicSurvey.publicSurveyId,
          clientSubmissionId: session.clientSubmissionId,
          answers,
          startedAt: session.startedAt,
          metadata,
        }).catch((error: unknown) => {
          console.warn("Remote progress save failed; local draft retained", error);
        });
      }, 1_200);
    };

    const completeSurvey = (sender: Model) => {
      void submit(sender.data as Record<string, unknown>);
    };

    model.onValueChanged.add(persistDraft);
    model.onCurrentPageChanged.add(persistDraft);
    model.onComplete.add(completeSurvey);

    return () => {
      clearTimeout(progressTimer);
      model.onValueChanged.remove(persistDraft);
      model.onCurrentPageChanged.remove(persistDraft);
      model.onComplete.remove(completeSurvey);
    };
  }, [metadata, model, publicSurvey, session, submit]);

  return (
    <section
      className="survey-shell"
      style={
        {
          "--brand-primary": publicSurvey.branding.primaryColor,
          "--brand-accent": publicSurvey.branding.accentColor,
        } as React.CSSProperties
      }
    >
      {!online && (
        <div className="network-banner" role="status">
          Offline: answers are saved on this device until you reconnect.
        </div>
      )}
      <header className="survey-brand-header">
        {publicSurvey.branding.logoUrl && (
          <img src={publicSurvey.branding.logoUrl} alt="" className="survey-logo" />
        )}
        <span>{publicSurvey.branding.organizationName}</span>
      </header>
      <Survey model={model} />

      {submissionState !== "answering" && (
        <div className="submission-panel" aria-live="assertive">
          {submissionState === "submitting" ? (
            <>
              <div className="spinner" aria-hidden="true" />
              <h2>Submitting your response…</h2>
              <p>Please keep this page open.</p>
            </>
          ) : (
            <>
              <h2>Response not submitted</h2>
              <p role="alert">{submissionError}</p>
              <button
                className="button"
                type="button"
                onClick={() => void submit(lastAnswers.current)}
              >
                Retry submission
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
