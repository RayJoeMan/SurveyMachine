import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase/client";
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
import {
  submissionFailure,
  type SubmissionFailure,
} from "@/modules/surveys/domain/submissionErrors";

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
  const [submissionError, setSubmissionError] = useState<SubmissionFailure | null>(null);
  const lastAnswers = useRef<Record<string, unknown>>({});

  const model = useMemo(() => {
    const survey = new Model(publicSurvey.schema);
    survey.locale = publicSurvey.settings.locale;
    survey.showCompletedPage = false;
    survey.data = loadLocalAnswers(publicSurvey.publicSurveyId);

    // Photo questions: upload each file to Firebase Storage under an
    // unguessable token path and store the download URL in the answer.
    survey.onUploadFiles.add((_survey, options) => {
      const token = crypto.randomUUID();
      const uploads = options.files.map(async (file) => {
        const safeName = file.name.replace(/[/\\]/g, "_");
        const fileRef = ref(
          storage,
          `survey-uploads/${publicSurvey.orgId}/${publicSurvey.surveyId}/${token}/${safeName}`,
        );
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        return { file: file.name, content: null, url };
      });
      Promise.all(uploads)
        .then((files) => options.callback(files, null))
        .catch((error: unknown) => {
          console.error("Photo upload failed", error);
          options.callback(null, ["The photo could not be uploaded. Try a smaller image."]);
        });
    });

    // Serve stored URLs back to SurveyJS so saved answers re-render.
    survey.onDownloadFile.add((_survey, options) => {
      const url = options.content || options.fileValue?.url;
      if (url) {
        options.callback("success", url);
      } else {
        options.callback("error", "File not found.");
      }
    });

    return survey;
  }, [publicSurvey]);

  const submit = useCallback(
    async (answers: Record<string, unknown>) => {
      lastAnswers.current = answers;
      if (!navigator.onLine) {
        saveLocalAnswers(publicSurvey.publicSurveyId, answers);
        setSubmissionState("failed");
        setSubmissionError({
          kind: "offline",
          message: "You are offline. Your answers are saved on this device; reconnect and retry.",
        });
        return;
      }

      setSubmissionState("submitting");
      setSubmissionError(null);
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
        // Permanent failures (capacity/closed/denied) must not keep a retry loop
        // alive; the draft is still preserved locally either way.
        saveLocalAnswers(publicSurvey.publicSurveyId, answers);
        setSubmissionState("failed");
        setSubmissionError(submissionFailure(error));
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
          ) : submissionError ? (
            <>
              <h2>Response not submitted</h2>
              <p role="alert">{submissionError.message}</p>
              {(submissionError.kind === "retryable" ||
                submissionError.kind === "validation" ||
                submissionError.kind === "offline") && (
                <button
                  className="button"
                  type="button"
                  onClick={() => void submit(lastAnswers.current)}
                >
                  Retry submission
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
