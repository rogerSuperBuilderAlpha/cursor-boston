import { expect, test, type Locator, type Page } from "@playwright/test";

const COHORT_MODAL_STORAGE_KEY = "cursor-boston-summer-cohort-modal-shown-date";
const VISUAL_DIFF_TOLERANCE = 0.1;

async function prepareTheme(page: Page, theme: "light" | "dark") {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(
    ({ key, themeValue }) => {
      localStorage.setItem("theme", themeValue);
      localStorage.setItem(key, new Date().toISOString().slice(0, 10));
    },
    { key: COHORT_MODAL_STORAGE_KEY, themeValue: theme }
  );
}

async function gotoHome(page: Page) {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Boston's Cursor Community" })
  ).toBeVisible();
}

async function contrastRatio(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    type BrowserRgba = {
      r: number;
      g: number;
      b: number;
      a: number;
    };

    const parseColor = (color: string): BrowserRgba | null => {
      const parseAlpha = (value: string | undefined) => {
        if (!value) return 1;
        return value.endsWith("%") ? Number(value.slice(0, -1)) / 100 : Number(value);
      };

      const rgbMatch = color.match(/^rgba?\((.*)\)$/);
      if (rgbMatch) {
        const parts = rgbMatch[1]
          .replace(/\s*\/\s*/, " ")
          .replace(/,/g, " ")
          .trim()
          .split(/\s+/);
        if (parts.length >= 3) {
          return {
            r: Number(parts[0]),
            g: Number(parts[1]),
            b: Number(parts[2]),
            a: parseAlpha(parts[3]),
          };
        }
      }

      const oklchMatch = color.match(
        /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(deg|rad|turn|grad)?(?:\s*\/\s*([0-9.]+%?))?\s*\)$/
      );
      if (!oklchMatch) return null;

      const lightness = oklchMatch[1].endsWith("%")
        ? Number(oklchMatch[1].slice(0, -1)) / 100
        : Number(oklchMatch[1]);
      const chroma = Number(oklchMatch[2]);
      const hueUnit = oklchMatch[4] ?? "deg";
      const hueValue = Number(oklchMatch[3]);
      const hue =
        hueUnit === "rad"
          ? hueValue
          : hueUnit === "turn"
            ? hueValue * 2 * Math.PI
            : hueUnit === "grad"
              ? (hueValue / 400) * 2 * Math.PI
              : (hueValue / 360) * 2 * Math.PI;
      const alpha = parseAlpha(oklchMatch[5]);
      const labA = chroma * Math.cos(hue);
      const labB = chroma * Math.sin(hue);
      const lPrime = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
      const mPrime = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
      const sPrime = lightness - 0.0894841775 * labA - 1.291485548 * labB;
      const l = lPrime ** 3;
      const m = mPrime ** 3;
      const s = sPrime ** 3;
      const toSrgb = (channel: number) => {
        const value =
          channel <= 0.0031308
            ? 12.92 * channel
            : 1.055 * channel ** (1 / 2.4) - 0.055;
        return Math.min(255, Math.max(0, value * 255));
      };

      return {
        r: toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
        a: alpha,
      };
    };

    const blend = (foreground: BrowserRgba, background: BrowserRgba): BrowserRgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
      };
    };

    const luminance = (channel: number) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    };

    const relativeLuminance = (color: BrowserRgba) =>
      0.2126 * luminance(color.r) +
      0.7152 * luminance(color.g) +
      0.0722 * luminance(color.b);

    const effectiveBackground = (start: Element): BrowserRgba => {
      let current: Element | null = start;
      let background: BrowserRgba = { r: 255, g: 255, b: 255, a: 1 };
      const layers: BrowserRgba[] = [];

      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed.a > 0) {
          layers.push(parsed);
          if (parsed.a >= 1) break;
        }
        current = current.parentElement;
      }

      for (const layer of layers.reverse()) {
        background = blend(layer, background);
      }

      return background;
    };

    const foreground = parseColor(getComputedStyle(element).color);
    if (!foreground) return 0;
    const background = effectiveBackground(element);
    const fg = blend(foreground, background);
    const lighter = Math.max(relativeLuminance(fg), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(fg), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
  });
}

async function expectContrast(
  locator: Locator,
  minimum: number,
  label: string
) {
  await expect(locator).toBeVisible();
  const ratio = await contrastRatio(locator);
  expect(ratio, `${label} contrast ratio`).toBeGreaterThanOrEqual(minimum);
}

test.describe("dark mode visual regression", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("captures a stable light home viewport", async ({ page }) => {
    await prepareTheme(page, "light");
    await gotoHome(page);

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page).toHaveScreenshot("home-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: VISUAL_DIFF_TOLERANCE,
    });
  });

  test("captures a stable dark home viewport", async ({ page }) => {
    await prepareTheme(page, "dark");
    await gotoHome(page);

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page).toHaveScreenshot("home-dark.png", {
      animations: "disabled",
      maxDiffPixelRatio: VISUAL_DIFF_TOLERANCE,
    });
  });

  test("keeps dark home text and primary CTA above WCAG AA contrast", async ({ page }) => {
    await prepareTheme(page, "dark");
    await gotoHome(page);

    await expectContrast(
      page.getByRole("heading", { name: "Boston's Cursor Community" }),
      4.5,
      "home heading"
    );
    await expectContrast(
      page.getByText("Bringing Cursor users together in Beantown.").first(),
      4.5,
      "home intro copy"
    );
    await expectContrast(
      page.getByRole("link", { name: /Subscribe to Events/i }),
      4.5,
      "primary event CTA"
    );
    await expectContrast(
      page.getByRole("link", { name: "View Events" }),
      4.5,
      "secondary event CTA"
    );
  });
});
