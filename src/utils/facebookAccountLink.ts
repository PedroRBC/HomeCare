import type { FacebookSignInToken } from "./facebookSignIn";

// The pending credential stays in memory and is usable only for this short flow.
export const FACEBOOK_LINK_TIMEOUT_MS = 10 * 60 * 1000;

export async function authenticateAndLinkFacebook<T extends { uid: string }>(options: {
  token: FacebookSignInToken;
  createdAt: number;
  now: () => number;
  authenticate: () => Promise<T>;
  isCurrent: (user: T) => boolean;
  link: (user: T, token: FacebookSignInToken) => Promise<T>;
}): Promise<T> {
  const assertFresh = () => {
    if (options.now() - options.createdAt >= FACEBOOK_LINK_TIMEOUT_MS) {
      throw new Error("FACEBOOK_LINK_EXPIRED");
    }
  };
  assertFresh();
  const user = await options.authenticate();
  assertFresh();
  if (!options.isCurrent(user)) throw new Error("FACEBOOK_LINK_SESSION_CHANGED");
  const linked = await options.link(user, options.token);
  if (linked.uid !== user.uid || !options.isCurrent(linked)) {
    throw new Error("FACEBOOK_LINK_SESSION_CHANGED");
  }
  return linked;
}
