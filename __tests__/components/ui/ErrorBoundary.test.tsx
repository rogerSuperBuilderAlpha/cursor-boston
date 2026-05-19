import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logger } from "@/lib/logger";

jest.mock("@/lib/logger", () => ({
  logger: {
    logError: jest.fn(),
  },
}));

// A component that throws on demand
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test explosion");
  return <p>Child content</p>;
}

// Suppress noisy console.error from React & componentDidCatch during boundary tests
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.mocked(logger.logError).mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders the default fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });

  it("renders a custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it('resets error state when "Try again" is clicked', async () => {
    const user = userEvent.setup();

    // We need a component whose throw status we can control via re-render.
    // After reset, ErrorBoundary re-renders children. If children no longer throw, content appears.
    let shouldThrow = true;

    function Controllable() {
      if (shouldThrow) throw new Error("boom");
      return <p>Recovered</p>;
    }

    render(
      <ErrorBoundary>
        <Controllable />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Stop throwing before clicking Try again
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });

  it("calls componentDidCatch and logs the error", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(logger.logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        boundary: "ErrorBoundary",
        componentStack: expect.any(String),
      }),
    );
  });

  it("renders custom title and description when provided", () => {
    render(
      <ErrorBoundary
        title="Failed to load questions"
        description="Failed to load questions. Please refresh."
      >
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Failed to load questions")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to load questions. Please refresh."),
    ).toBeInTheDocument();
  });
});
