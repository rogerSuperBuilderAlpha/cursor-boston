/**
 * @jest-environment node
 */

const mockCreate = jest.fn();
const mockClient = jest.fn(() => ({ messages: { create: mockCreate } }));
const MockMailgun = jest.fn().mockImplementation(() => ({ client: mockClient }));

jest.mock("mailgun.js", () => ({
  __esModule: true,
  default: MockMailgun,
}));

jest.mock("form-data", () => ({
  __esModule: true,
  default: class FormDataStub {},
}));

const ORIGINAL_ENV = { ...process.env };

async function loadFreshModule() {
  let mod: typeof import("@/lib/mailgun");
  await jest.isolateModulesAsync(async () => {
    mod = await import("@/lib/mailgun");
  });
  return mod!;
}

describe("lib/mailgun", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockClient.mockClear();
    MockMailgun.mockClear();
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.MAILGUN_FROM;
    delete process.env.MAILGUN_EU;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws when MAILGUN_DOMAIN is unset", async () => {
    const { sendEmail } = await loadFreshModule();
    await expect(
      sendEmail({ to: "x@y.com", subject: "s", text: "t" }),
    ).rejects.toThrow("MAILGUN_DOMAIN is not set");
  });

  it("throws when neither text nor html is provided", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    const { sendEmail } = await loadFreshModule();
    await expect(
      sendEmail({ to: "x@y.com", subject: "s" }),
    ).rejects.toThrow("Either text or html is required for sendEmail");
  });

  it("throws when MAILGUN_API_KEY is unset (client init)", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    const { sendEmail } = await loadFreshModule();
    await expect(
      sendEmail({ to: "x@y.com", subject: "s", text: "t" }),
    ).rejects.toThrow("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set");
  });

  it("sends with text payload and default noreply from", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValueOnce({ id: "msg-1" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "user@x.com", subject: "hi", text: "hello" });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const [domain, payload] = mockCreate.mock.calls[0];
    expect(domain).toBe("mg.example.com");
    expect(payload).toEqual({
      from: "noreply@mg.example.com",
      to: ["user@x.com"],
      subject: "hi",
      text: "hello",
    });
  });

  it("sends with html payload only (no text)", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValueOnce({ id: "msg-2" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "user@x.com", subject: "hi", html: "<p>hello</p>" });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload).toEqual({
      from: "noreply@mg.example.com",
      to: ["user@x.com"],
      subject: "hi",
      html: "<p>hello</p>",
    });
    expect(payload).not.toHaveProperty("text");
  });

  it("includes both text and html when both are provided", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValueOnce({ id: "msg-3" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({
      to: "user@x.com",
      subject: "hi",
      text: "plain",
      html: "<p>rich</p>",
    });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload.text).toBe("plain");
    expect(payload.html).toBe("<p>rich</p>");
  });

  it("normalizes a single-string to into an array", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValueOnce({ id: "msg-4" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "solo@x.com", subject: "s", text: "t" });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload.to).toEqual(["solo@x.com"]);
  });

  it("preserves an array-shaped to without re-wrapping", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValueOnce({ id: "msg-5" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({
      to: ["a@x.com", "b@x.com"],
      subject: "s",
      text: "t",
    });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload.to).toEqual(["a@x.com", "b@x.com"]);
  });

  it("uses explicit options.from when provided", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_FROM = "fallback@mg.example.com";
    mockCreate.mockResolvedValueOnce({ id: "msg-6" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({
      to: "u@x.com",
      subject: "s",
      text: "t",
      from: "explicit@mg.example.com",
    });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload.from).toBe("explicit@mg.example.com");
  });

  it("falls back to MAILGUN_FROM env when options.from is omitted", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_FROM = "fallback@mg.example.com";
    mockCreate.mockResolvedValueOnce({ id: "msg-7" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "u@x.com", subject: "s", text: "t" });
    const [, payload] = mockCreate.mock.calls[0];
    expect(payload.from).toBe("fallback@mg.example.com");
  });

  it("configures EU region URL when MAILGUN_EU=true", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_EU = "true";
    mockCreate.mockResolvedValueOnce({ id: "msg-8" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "u@x.com", subject: "s", text: "t" });
    expect(mockClient).toHaveBeenCalledTimes(1);
    expect(mockClient.mock.calls[0][0]).toEqual({
      username: "api",
      key: "key-test",
      url: "https://api.eu.mailgun.net",
    });
  });

  it("omits EU URL when MAILGUN_EU is not exactly 'true'", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_EU = "1";
    mockCreate.mockResolvedValueOnce({ id: "msg-9" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "u@x.com", subject: "s", text: "t" });
    const opts = mockClient.mock.calls[0][0];
    expect(opts).toEqual({ username: "api", key: "key-test" });
    expect(opts).not.toHaveProperty("url");
  });

  it("constructs Mailgun with FormData and caches the client across calls", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockResolvedValue({ id: "msg-cache" });
    const { sendEmail } = await loadFreshModule();
    await sendEmail({ to: "u@x.com", subject: "s", text: "t" });
    await sendEmail({ to: "u@x.com", subject: "s", text: "t" });
    expect(MockMailgun).toHaveBeenCalledTimes(1);
    expect(mockClient).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("propagates errors thrown by mg.messages.create", async () => {
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_API_KEY = "key-test";
    mockCreate.mockRejectedValueOnce(new Error("upstream 401"));
    const { sendEmail } = await loadFreshModule();
    await expect(
      sendEmail({ to: "u@x.com", subject: "s", text: "t" }),
    ).rejects.toThrow("upstream 401");
  });
});
