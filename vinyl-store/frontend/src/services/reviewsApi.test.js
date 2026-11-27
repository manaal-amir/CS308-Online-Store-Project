// Tests for the rating and comment helpers (SCRUM-57, SCRUM-58, SCRUM-60).
import { afterEach, describe, expect, test, vi } from "vitest";
import { getApprovedComments, getMyReview, postComment, rateProduct } from "./reviewsApi.js";

function response(data, ok = true, status = 200) {
  return { ok, status, json: async () => data };
}

function stubFetch(result) {
  const fetchMock = vi.fn().mockResolvedValue(result);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMyReview", () => {
  test("asks what the signed-in customer can do on this record", async () => {
    const mine = { canReview: true, rating: 4, hasPendingComment: false };
    const fetchMock = stubFetch(response(mine));

    await expect(getMyReview("tok", 7)).resolves.toEqual(mine);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/products/7/reviews/me");
    expect(options.method).toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });

  test("encodes the product id", async () => {
    const fetchMock = stubFetch(response({}));

    await getMyReview("tok", "7/ratings");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/products/7%2Fratings/reviews/me");
  });
});

describe("rateProduct", () => {
  test("posts the stars and returns the new average", async () => {
    const result = { productId: 7, value: 5, averageRating: 4.5, ratingCount: 2 };
    const fetchMock = stubFetch(response(result));

    await expect(rateProduct("tok", 7, 5)).resolves.toEqual(result);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/products/7/ratings");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ value: 5 });
  });
});

describe("errors", () => {
  test("keeps the API message and status when the record was not delivered", async () => {
    stubFetch(response({ error: "You can only rate records that have been delivered to you" }, false, 403));

    await expect(rateProduct("tok", 7, 3)).rejects.toMatchObject({
      message: "You can only rate records that have been delivered to you",
      status: 403,
    });
  });

  test("falls back to a generic message when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    await expect(getMyReview("tok", 7)).rejects.toMatchObject({
      message: "Review request failed (500)",
      status: 500,
    });
  });

  test("reports an unreachable server in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(rateProduct("tok", 7, 3)).rejects.toThrow(
      "Could not reach the server. Please try again later.",
    );
  });

  test("lets an abort through unchanged", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(getMyReview("tok", 7)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("getApprovedComments", () => {
  test("reads the approved comments without needing a token", async () => {
    const comments = [{ id: 1, content: "Great", authorName: "Ada L.", createdAt: "2026-11-20T10:00:00.000Z" }];
    const fetchMock = stubFetch(response(comments));

    await expect(getApprovedComments(7)).resolves.toEqual(comments);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/products/7/comments");
    expect(options.method).toBe("GET");
    expect(options.headers.Authorization).toBeUndefined();
  });

  test("passes the abort signal", async () => {
    const fetchMock = stubFetch(response([]));
    const controller = new AbortController();

    await getApprovedComments(7, controller.signal);

    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

describe("postComment", () => {
  test("posts the comment text with the token", async () => {
    const created = { id: 3, productId: 7, content: "Lovely", status: "PENDING" };
    const fetchMock = stubFetch(response(created, true, 201));

    await expect(postComment("tok", 7, "Lovely")).resolves.toEqual(created);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/products/7/comments");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(options.body)).toEqual({ content: "Lovely" });
  });

  test("keeps the status when a comment is already waiting for approval", async () => {
    stubFetch(response({ error: "You already have a comment waiting for approval on this record" }, false, 409));

    await expect(postComment("tok", 7, "Again")).rejects.toMatchObject({
      message: "You already have a comment waiting for approval on this record",
      status: 409,
    });
  });
});
