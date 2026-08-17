import { ReCaptchaEnterpriseProvider, initializeAppCheck } from "firebase/app-check";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { env } from "@/config/env";

const app = getApps().length > 0 ? getApp() : initializeApp(env.firebase);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, env.functionsRegion);
export const storage = getStorage(app);

const emulatorFlag = "__surveyModuleEmulatorsConnected";
const globalScope = globalThis as typeof globalThis & Record<string, boolean>;

if (env.useEmulators && !globalScope[emulatorFlag]) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  globalScope[emulatorFlag] = true;
}

if (!env.useEmulators && env.measurementId) {
  // Analytics is optional and only enabled for real environments; it is skipped
  // in jsdom tests and when no measurement ID is configured.
  void isSupported().then((supported) => {
    if (supported) getAnalytics(app);
  });
}

if (!env.useEmulators && env.recaptchaEnterpriseSiteKey && env.appCheckEnabled) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.recaptchaEnterpriseSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
