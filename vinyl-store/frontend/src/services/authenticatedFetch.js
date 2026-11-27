import { expireAuthSession } from "../utils/authSession.js";

export async function authenticatedFetch(url, token, options) {
  const response = await fetch(url, options);
  if (response.status === 401 && token) expireAuthSession(token);
  return response;
}
