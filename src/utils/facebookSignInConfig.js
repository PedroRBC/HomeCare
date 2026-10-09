// Plain JavaScript keeps this helper usable by Expo's Node-based config loader.
const PLACEHOLDER_PATTERN =
  /\$\{?[A-Z0-9_]+\}?|<[^>]+>|\b(?:your|replace|placeholder|example|changeme|todo)[-_ ]/i;

/** @param {unknown} value @returns {value is string} */
const isNonPlaceholderString = (value) =>
  typeof value === "string" && value.trim().length > 0 && !PLACEHOLDER_PATTERN.test(value.trim());

/** @param {unknown} value @returns {value is string} */
const isFacebookAppId = (value) => isNonPlaceholderString(value) && /^\d+$/.test(value.trim());

/** @param {unknown} value @returns {value is string} */
const isFacebookClientToken = (value) => isNonPlaceholderString(value);

/**
 * Resolve the optional Facebook native-login configuration.
 *
 * @param {{ appId?: unknown, clientToken?: unknown }} options
 * @returns {{ enabled: false, appId?: undefined, clientToken?: undefined } | { enabled: true, appId: string, clientToken: string }}
 */
const resolveFacebookConfig = ({ appId, clientToken }) => {
  const normalizedAppId = typeof appId === "string" ? appId.trim() : "";
  const normalizedClientToken = typeof clientToken === "string" ? clientToken.trim() : "";

  if (!normalizedAppId && !normalizedClientToken) {
    return { enabled: false };
  }

  if (!isFacebookAppId(normalizedAppId)) {
    throw new Error(
      "FACEBOOK_APP_ID must be a numeric Facebook App ID when FACEBOOK_CLIENT_TOKEN is configured; remove both variables to disable Facebook Sign-In.",
    );
  }

  if (!isFacebookClientToken(normalizedClientToken)) {
    throw new Error(
      "FACEBOOK_CLIENT_TOKEN must be a real Facebook Client Token when FACEBOOK_APP_ID is configured; remove both variables to disable Facebook Sign-In.",
    );
  }

  return {
    enabled: true,
    appId: normalizedAppId,
    clientToken: normalizedClientToken,
  };
};

module.exports = { isFacebookAppId, isFacebookClientToken, resolveFacebookConfig };
