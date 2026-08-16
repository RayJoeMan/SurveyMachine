import { Link } from "react-router-dom";
import { MessageState } from "@/shared/AsyncState";

export function NotFoundPage() {
  return (
    <MessageState title="Page not found">
      <p>The page may have moved or the link may be incomplete.</p>
      <Link className="button" to="/">
        Return home
      </Link>
    </MessageState>
  );
}
