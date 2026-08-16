import { httpsCallable } from "firebase/functions";
import type { SaveProgressInput, SubmitResponseInput } from "@/contracts";
import { functions } from "@/firebase/client";

interface ResponseResult {
  ok: true;
  requestId: string;
  responseId: string;
  duplicate?: boolean;
  completed?: boolean;
}

const saveProgressCallable = httpsCallable<SaveProgressInput, ResponseResult>(
  functions,
  "saveSurveyProgressV1",
);
const submitResponseCallable = httpsCallable<SubmitResponseInput, ResponseResult>(
  functions,
  "submitSurveyResponseV1",
);

export async function saveSurveyProgress(input: SaveProgressInput): Promise<ResponseResult> {
  return (await saveProgressCallable(input)).data;
}

export async function submitSurveyResponse(input: SubmitResponseInput): Promise<ResponseResult> {
  return (await submitResponseCallable(input)).data;
}
