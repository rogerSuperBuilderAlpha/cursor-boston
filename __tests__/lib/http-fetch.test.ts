import { fetchWithTimeout } from "@/lib/http-fetch";

describe("http-fetch", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it("delegates to fetch with an AbortController-backed signal", async () => {
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      capturedInit = init;
      return { ok: true } as unknown as Response;
    }) as unknown as typeof fetch;

    await fetchWithTimeout("https://example.com");
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("forwards caller init options", async () => {
    let capturedInit: RequestInit | undefined;
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      capturedInit = init;
      return { ok: true } as unknown as Response;
    }) as unknown as typeof fetch;

    await fetchWithTimeout("https://example.com", { method: "POST", body: "hi" });
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBe("hi");
  });

  it("aborts when the timeout elapses", async () => {
    let abortedFromTimer = false;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        signal?.addEventListener("abort", () => {
          abortedFromTimer = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const promise = fetchWithTimeout("https://example.com", {}, 50);
    await expect(promise).rejects.toBeDefined();
    expect(abortedFromTimer).toBe(true);
  });

  it("propagates an externally-aborted signal", async () => {
    let observedAbort = false;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        if (signal?.aborted) {
          observedAbort = true;
          reject(new DOMException("aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          observedAbort = true;
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const external = new AbortController();
    const promise = fetchWithTimeout("https://example.com", { signal: external.signal }, 30_000);
    external.abort();
    await expect(promise).rejects.toBeDefined();
    expect(observedAbort).toBe(true);
  });

  it("does not call abort when the request finishes within the timeout", async () => {
    const fetchMock = jest
      .fn()
      .mockImplementation(async () => ({ ok: true }) as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await fetchWithTimeout("https://example.com", {}, 1_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
