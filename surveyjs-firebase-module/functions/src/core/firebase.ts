import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export function getDefaultBucket() {
  return getStorage().bucket();
}
