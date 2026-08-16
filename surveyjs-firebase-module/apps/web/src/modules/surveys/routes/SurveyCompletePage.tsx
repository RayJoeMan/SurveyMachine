import { Link, useParams } from "react-router-dom";
import { MessageState } from "@/shared/AsyncState";

export function SurveyCompletePage() {
  const { publicSurveyId = "" } = useParams();
  return (
    <MessageState title="Thank you" tone="success">
      <p>Your response was submitted successfully.</p>
      <div className="button-row">
        <Link className="button" to="/">
          Done
        </Link>
        <Link className="text-link" to={`/s/${publicSurveyId}`}>
          Start a new response
        </Link>
      </div>
    </MessageState>
  );
}
