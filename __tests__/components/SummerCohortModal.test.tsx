import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SummerCohortModal from "@/components/SummerCohortModal";
import {
  SUMMER_COHORT_LOCALSTORAGE_KEY,
  SUMMER_COHORT_OPEN_EVENT,
} from "@/lib/summer-cohort";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("SummerCohortModal", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it("auto-opens on first visit (no localStorage flag for today)", () => {
    render(<SummerCohortModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("Cursor Boston Summer Cohort")
    ).toBeInTheDocument();
  });

  it("does not auto-open if today's date is already stored", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders both cohort date rows and the Apply button", () => {
    render(<SummerCohortModal />);
    expect(screen.getByText("Cohort 1")).toBeInTheDocument();
    expect(screen.getByText("Cohort 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /apply/i })).toHaveAttribute(
      "href",
      "/summer-cohort"
    );
  });

  it("closes and writes today's date on close", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await user.click(
      screen.getByRole("button", { name: /close summer cohort/i })
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SUMMER_COHORT_LOCALSTORAGE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when Maybe later is clicked", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    await user.click(screen.getByText("Maybe later"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    const user = userEvent.setup();
    render(<SummerCohortModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("re-opens on the open-summer-cohort-modal custom event", () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorageMock.getItem.mockReturnValueOnce(today);
    render(<SummerCohortModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent(SUMMER_COHORT_OPEN_EVENT));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has aria-modal and aria-labelledby on the dialog", () => {
    render(<SummerCohortModal />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "summer-cohort-title");
  });
});
