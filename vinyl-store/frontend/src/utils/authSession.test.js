import { authenticatedFetch } from "../services/authenticatedFetch.js";
import { getAuthSession, monitorAuthSession, saveAuthSession } from "./authSession.js";

const key = "vinyl-store-auth-session";

function session(expiry) {
  const payload = btoa(JSON.stringify({ exp: expiry / 1000 }));
  return { token: `header.${payload.replace(/=+$/, "")}.signature`, user: { id: 1 } };
}

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test.each([true, false])("clears an expired session when read (remember me: %s)", (remember) => {
  saveAuthSession(session(Date.now() - 1000), remember);

  expect(getAuthSession()).toBeNull();
  expect((remember ? localStorage : sessionStorage).getItem(key)).toBeNull();
});

test("expires a remembered session while the page stays open", () => {
  vi.useFakeTimers();
  const active = session(Date.now() + 2000);
  const onExpired = vi.fn();
  saveAuthSession(active, true);
  const stop = monitorAuthSession(onExpired);
  try {
    vi.advanceTimersByTime(1999);
    expect(getAuthSession()).toEqual(active);
    expect(onExpired).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(getAuthSession()).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});

test("a 401 from an older session preserves a newer login", async () => {
  const first = session(Date.now() + 10000);
  const second = session(Date.now() + 20000);
  let respond;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((resolve) => { respond = resolve; })));
  saveAuthSession(first);
  const request = authenticatedFetch("/api/orders", first.token);
  saveAuthSession(second, true);
  respond(new Response(null, { status: 401 }));

  expect((await request).status).toBe(401);
  expect(getAuthSession()).toEqual(second);
});

test("an authenticated 401 clears the active login, while a 403 preserves it", async () => {
  const active = session(Date.now() + 10000);
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 })));
  saveAuthSession(active, true);

  await authenticatedFetch("/api/orders", active.token);
  expect(getAuthSession()).toEqual(active);
  await authenticatedFetch("/api/orders", active.token);
  expect(getAuthSession()).toBeNull();
});
