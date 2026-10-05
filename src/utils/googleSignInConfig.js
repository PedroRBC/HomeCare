// Plain JavaScript keeps this helper usable by Expo's Node-based config loader.
/** @param {unknown} value @returns {value is string} */
const isGoogleClientId = (value) =>
  typeof value === "string" && /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(value);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === "object" && value !== null;

/**
 * @param {{ webClientId?: string, androidPackage: string, loadGoogleServices: () => unknown }} options
 * @returns {string}
 */
const resolveGoogleWebClientId = ({ webClientId, androidPackage, loadGoogleServices }) => {
  const override = webClientId?.trim();
  if (override) {
    if (!isGoogleClientId(override)) {
      throw new Error(
        "GOOGLE_WEB_CLIENT_ID must be a Web OAuth client ID, not a placeholder or shell variable.",
      );
    }
    return override;
  }

  const googleServices = loadGoogleServices();
  if (!isRecord(googleServices) || !Array.isArray(googleServices.client)) {
    throw new Error("The selected google-services.json has no Firebase Android clients.");
  }

  const clients = googleServices.client.filter((client) => {
    if (!isRecord(client) || !isRecord(client.client_info)) return false;
    const androidInfo = client.client_info.android_client_info;
    return isRecord(androidInfo) && androidInfo.package_name === androidPackage;
  });
  if (clients.length === 0) {
    throw new Error(`The selected google-services.json has no client for ${androidPackage}.`);
  }

  /** @type {Set<string>} */
  const webClientIds = new Set();
  for (const client of clients) {
    if (!isRecord(client) || !Array.isArray(client.oauth_client)) continue;
    for (const oauthClient of client.oauth_client) {
      if (!isRecord(oauthClient) || oauthClient.client_type !== 3) continue;
      if (!isGoogleClientId(oauthClient.client_id)) {
        throw new Error(
          "The selected google-services.json contains an invalid Web OAuth client ID.",
        );
      }
      webClientIds.add(oauthClient.client_id);
    }
  }

  if (webClientIds.size !== 1) {
    throw new Error(
      "The selected google-services.json must contain exactly one distinct Web OAuth client ID for the Android package. Enable Google in Firebase Authentication and download the updated file, or set GOOGLE_WEB_CLIENT_ID explicitly.",
    );
  }

  return [...webClientIds][0];
};

module.exports = { isGoogleClientId, resolveGoogleWebClientId };
