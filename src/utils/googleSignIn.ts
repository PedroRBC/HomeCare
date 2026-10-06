import type { GoogleSignin } from "@react-native-google-signin/google-signin";
import { isGoogleClientId } from "./googleSignInConfig";

export type GoogleSignInClient = Pick<
  typeof GoogleSignin,
  "configure" | "hasPlayServices" | "signIn"
>;

interface GoogleSignInOptions {
  webClientId?: unknown;
  iosClientId?: string;
}

export const getGoogleIdToken = async (
  client: GoogleSignInClient,
  { webClientId, iosClientId }: GoogleSignInOptions,
): Promise<string | null> => {
  if (!isGoogleClientId(webClientId)) {
    throw new Error(
      "Google Sign-In requires a valid Web OAuth client ID. Rebuild the app with the corrected configuration.",
    );
  }

  await client.hasPlayServices({ showPlayServicesUpdateDialog: true });
  client.configure({
    webClientId,
    iosClientId,
    scopes: ["profile", "email"],
    offlineAccess: false,
  });
  const result = await client.signIn();
  if (result.type === "cancelled") return null;

  const idToken = result.data.idToken;
  if (!idToken?.trim()) {
    throw new Error(
      "No ID token received from Google. Check the Web OAuth client ID and Android signing certificate.",
    );
  }
  return idToken;
};
