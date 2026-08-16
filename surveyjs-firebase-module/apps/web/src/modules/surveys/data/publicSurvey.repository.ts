import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { PublicSurveySchema, type PublicSurvey } from "@/contracts";
import { db } from "@/firebase/client";

export class SurveyUnavailableError extends Error {
  constructor() {
    super("This survey is unavailable or the survey module is disabled.");
    this.name = "SurveyUnavailableError";
  }
}

export async function getPublicSurvey(publicSurveyId: string): Promise<PublicSurvey | null> {
  try {
    const snapshot = await getDoc(doc(db, "publicSurveys", publicSurveyId));
    if (!snapshot.exists()) return null;
    return PublicSurveySchema.parse(snapshot.data());
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new SurveyUnavailableError();
    }
    throw error;
  }
}
