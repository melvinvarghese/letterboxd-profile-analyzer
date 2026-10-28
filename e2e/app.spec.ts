import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
const fixtures = ["watched", "ratings", "diary", "watchlist"].map((n) =>
  path.resolve("tests/fixtures/" + n + ".csv"),
);
const fixtureBytes = Promise.all(
  fixtures.map(
    async (f) =>
      [path.basename(f), new Uint8Array(await fs.readFile(f))] as const,
  ),
);
async function importFixture(page: any) {
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page
    .getByLabel("Choose Letterboxd export files")
    .setInputFiles(fixtures);
  await expect(
    page.getByText("Import checked. Ready to explore."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze my data", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your life, measured in films." }),
  ).toBeVisible();
}
async function nav(page: any, name: string) {
  const btn = page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true });
  if (
    (page.viewportSize()?.width || 1440) <= 1050 &&
    !(await page.locator(".sidebar.open").count())
  )
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await btn.click();
}
const issues = new Map<any, string[]>();
test.beforeEach(async ({ page }) => {
  issues.set(page, []);
  page.on("pageerror", (e) => issues.get(page)!.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith("http://127.0.0.1"))
      issues.get(page)!.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  await page.goto("./");
});
test.afterEach(async ({ page }) => {
  expect(issues.get(page)).toEqual([]);
});
test("first run is clear, private and keyboard accessible; theme survives reload", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every film leavesa trace.",
  );
  await expect(
    page.getByRole("button", { name: "Analyze my Letterboxd data" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByText("Skip to analysis")).toBeFocused();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/welcome-desktop.png",
    fullPage: true,
  });
});
test("CSV import preview and exact dashboard metrics; local processing makes no external requests", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1") &&
      !r.url().startsWith("blob:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await importFixture(page);
  const metrics = page.locator(".metrics").first();
  await expect(metrics.locator(".metric").nth(0)).toContainText("8");
  await expect(metrics.locator(".metric").nth(1)).toContainText("9");
  await expect(metrics.locator(".metric").nth(2)).toContainText("3.71");
  await expect(metrics.locator(".metric").nth(3)).toContainText("1");
  expect(external).toEqual([]);
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
test("real ZIP extraction in worker handles wrapper folder and excluded paths", async ({
  page,
}) => {
  const zip = zipSync(
    Object.fromEntries([
      ...(await fixtureBytes).map(([n, b]) => ["letterboxd-export/" + n, b]),
      [
        "letterboxd-export/deleted/watched.csv",
        strToU8("Name\nExcluded title"),
      ],
      [
        "letterboxd-export/profile.csv",
        strToU8("Username,Email\nfixture-user,never-retain@example.test"),
      ],
    ]),
  );
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page.getByLabel("Choose Letterboxd export files").setInputFiles({
    name: "export.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zip),
  });
  await expect(
    page.getByText("Import checked. Ready to explore."),
  ).toBeVisible();
  await expect(page.getByText(/1 excluded paths/)).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze my data", exact: true })
    .click();
  await expect(
    page.locator(".metrics").first().locator(".metric").first(),
  ).toContainText("8");
  await expect(page.locator("body")).not.toContainText(
    "never-retain@example.test",
  );
});
test("invalid import shows recovery instructions and preserves the active analysis", async ({
  page,
}) => {
  await importFixture(page);
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page.getByLabel("Choose Letterboxd export files").setInputFiles({
    name: "broken.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "damaged",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(".metrics").first().locator(".metric").first(),
  ).toContainText("8");
  await expect(
    page.getByRole("button", { name: "Import data", exact: true }),
  ).toBeFocused();
});
test("global date/rating filters, chart drilldowns and reset affect the actual results", async ({
  page,
}) => {
  await importFixture(page);
  await page.getByLabel("Diary year", { exact: true }).selectOption("2024");
  await expect(page.locator(".filter-caption")).toContainText(
    "3 films · 4 diary entries",
  );
  await page.locator(".reset-filters").click();
  await page
    .getByRole("button", { name: "4: 2, show records", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every title has a story." }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.locator(".reset-filters").click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByLabel("From", { exact: true }).fill("2025-01-01");
  await page.getByLabel("To", { exact: true }).fill("2025-01-02");
  await expect(page.locator("tbody tr")).toHaveCount(2);
});
test("film explorer searches international titles, sorts, opens details and exports CSV", async ({
  page,
}) => {
  await importFixture(page);
  await nav(page, "Film explorer");
  await page.getByRole("searchbox", { name: "Search films" }).fill("東京");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: /東京物語/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("2025-01-02");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Reset explorer" }).click();
  await page.getByLabel("Sort films").selectOption("rating-desc");
  await expect(page.locator("tbody tr").first()).toContainText("東京物語");
  const dlPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const dl = await dlPromise;
  expect(dl.suggestedFilename()).toBe("frame-by-frame-films.csv");
  const text = await fs.readFile((await dl.path())!, "utf8");
  expect(text).toContain("Rain, Then Sun");
  expect(text).toContain("東京物語");
});
test("diary calendar and year comparison use logged event dates", async ({
  page,
}) => {
  await importFixture(page);
  await nav(page, "Diary & activity");
  await expect(page.getByText("4 days", { exact: true })).toBeVisible();
  await expect(
    page.getByText("2 undated retained", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Calendar year").selectOption("2024");
  await page
    .getByRole("button", {
      name: "2024-01-01: 1 entries, explore",
      exact: true,
    })
    .click();
  await expect(page.locator(".filter-caption")).toContainText(
    "1 films · 1 diary entries",
  );
  await page.locator(".reset-filters").click();
  await nav(page, "Compare years");
  await page.getByLabel("Year A", { exact: true }).selectOption("2024");
  await page.getByLabel("Year B", { exact: true }).selectOption("2025");
  await expect(
    page.getByText("2025 has 1 fewer diary entries than 2024.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("analysis backup round trip, optional device save, reload and clearing saved data", async ({
  page,
}) => {
  await importFixture(page);
  await nav(page, "Data & privacy");
  const dlPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download analysis backup" }).click();
  const dl = await dlPromise,
    backup = await fs.readFile((await dl.path())!);
  const snapshot = JSON.parse(backup.toString());
  expect(snapshot.format).toBe("frame-by-frame");
  expect(snapshot.files).toHaveLength(4);
  await page.getByLabel("Save analysis on this browser and device").check();
  await expect(
    page.getByText("Saved on this browser and device.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your life, measured in films." }),
  ).toBeVisible();
  await nav(page, "Data & privacy");
  await page
    .getByRole("button", { name: "Clear all imported and saved data" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear all data", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every film leavesa trace.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every film leavesa trace.",
  );
  await page.getByLabel("Restore saved analysis JSON").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect(
    page.getByRole("heading", { name: "Your life, measured in films." }),
  ).toBeVisible();
  await expect(
    page.locator(".metrics").first().locator(".metric").nth(1),
  ).toContainText("9");
});
test("shareable report is a real SVG with computed metrics", async ({
  page,
}) => {
  await importFixture(page);
  await nav(page, "Data & privacy");
  const p = page.waitForEvent("download");
  await page.getByRole("button", { name: "Movie report image" }).click();
  const d = await p;
  const svg = await fs.readFile((await d.path())!, "utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("3.71");
  expect(svg).not.toContain("<script");
  await nav(page, "Overview");
  await page.getByLabel("Personal rating").selectOption("4");
  await nav(page, "Data & privacy");
  const again = page.waitForEvent("download");
  await page.getByRole("button", { name: "Movie report image" }).click();
  const scoped = await fs.readFile((await (await again).path())!, "utf8");
  expect(scoped).toContain("Personal rating 4 / 5");
  expect(scoped).toContain("4.00");
});
test("profile comparison works before a main import and remains separate", async ({
  page,
}) => {
  await nav(page, "Compare profiles");
  await page.getByLabel("Choose Profile A export").setInputFiles(fixtures);
  await page.getByLabel("Choose Profile B export").setInputFiles(fixtures);
  await page
    .getByRole("button", { name: "Compare profiles", exact: true })
    .last()
    .click();
  await expect(
    page.locator(".metrics").first().locator(".metric").first(),
  ).toContainText("8");
  await expect(
    page.getByText("Pearson correlation: 1.00.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await nav(page, "Overview");
  await nav(page, "Compare profiles");
  await expect(
    page.locator(".metrics").first().locator(".metric").first(),
  ).toContainText("8");
  await page.getByRole("button", { name: "Clear comparison" }).click();
  await expect(
    page.getByRole("button", { name: "Compare profiles", exact: true }).last(),
  ).toBeDisabled();
  await nav(page, "Overview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every film leavesa trace.",
  );
});
test("TMDB requests are opt-in; mocked enrichment, uncertain match review and corrections are real", async ({
  page,
}) => {
  await importFixture(page);
  const requests: string[] = [];
  await page.route("https://api.themoviedb.org/3/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.pathname.includes("/search/"))
      return route.fulfill({
        json: {
          results:
            url.searchParams.get("query") === "The Long Crossing"
              ? [
                  {
                    id: 7701,
                    title: "The Long Crossing",
                    release_date: "1998-01-01",
                  },
                  {
                    id: 7702,
                    title: "The Long Crossing",
                    release_date: "1998-01-01",
                  },
                ]
              : [],
        },
      });
    return route.fulfill({
      json: {
        id: Number(url.pathname.split("/").pop()),
        title: "Confirmed fixture match",
        release_date: "2001-01-01",
        runtime: 100,
        vote_average: 8,
        vote_count: 150,
        genres: [{ name: "Drama" }],
        production_countries: [{ name: "France" }],
        original_language: "fr",
        credits: {
          crew: [{ job: "Director", name: "Test Director" }],
          cast: [{ name: "Test Actor" }],
        },
      },
    });
  });
  await nav(page, "Data & privacy");
  await page
    .getByLabel("Your TMDB API key or read access token")
    .fill("fixture-read-token");
  await expect(
    page.getByRole("button", { name: "Enrich next batch" }),
  ).toBeDisabled();
  expect(requests).toHaveLength(0);
  await page.getByLabel("I choose to send film search terms").check();
  await nav(page, "Film explorer");
  await page.getByRole("button", { name: /A Quiet Orbit/ }).click();
  await page
    .getByText("Review or correct the TMDB match", { exact: true })
    .click();
  await page.getByLabel("TMDB movie ID").fill("550");
  await page.getByRole("button", { name: "Use this movie ID" }).click();
  await expect(page.getByRole("dialog")).toContainText("Test Director");
  await expect(page.getByRole("dialog")).toContainText("100 minutes");
  await page.keyboard.press("Escape");
  await nav(page, "Directors & actors");
  await expect(
    page.getByRole("button", { name: /Test Director/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Test Director/ }).click();
  await expect(page.getByRole("dialog")).toContainText("A Quiet Orbit");
  await page.keyboard.press("Escape");
  await nav(page, "Data & privacy");
  await page.getByLabel("Batch size").selectOption("25");
  await page.getByRole("button", { name: "Enrich next batch" }).click();
  await expect(
    page.getByText("TMDB batch finished:", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  expect(requests.some((p) => p.includes("/search/"))).toBeTruthy();
  await nav(page, "Film explorer");
  await page.getByRole("button", { name: /The Long Crossing/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "The match is uncertain.",
  );
  await page.getByRole("button", { name: /Use ID 7701/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Test Director");
  await expect(page.getByRole("dialog")).toContainText("TMDB movie 7701");
  await page.keyboard.press("Escape");
  await page.reload();
  await nav(page, "Data & privacy");
  await expect(
    page.getByLabel("Your TMDB API key or read access token"),
  ).toHaveValue("");
});
for (const width of [360, 768, 1440])
  test(`responsive layout and accessibility at ${width}px, both themes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await importFixture(page);
    await nav(page, "Film explorer");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/films-${width}.png`,
      fullPage: true,
    });
    for (const theme of ["dark", "light"]) {
      if (theme === "light")
        await page
          .getByRole("button", { name: "Switch to light theme" })
          .click();
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(axe.violations).toEqual([]);
    }
    await nav(page, "Diary & activity");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/diary-${width}.png`,
      fullPage: true,
    });
    await nav(page, "Data & privacy");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  });

test("paginated explorer reaches every record and handles imports without optional datasets", async ({
  page,
}) => {
  const csv =
    "Name,Year\n" +
    Array.from(
      { length: 65 },
      (_, i) => `Synthetic ${String(i).padStart(2, "0")},${2000 + (i % 20)}`,
    ).join("\n");
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page.getByLabel("Choose Letterboxd export files").setInputFiles({
    name: "watched.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByText("Import checked. Ready to explore."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze my data", exact: true })
    .click();
  await nav(page, "Film explorer");
  await expect(page.locator("tbody tr")).toHaveCount(30);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".pager")).toContainText("31–60 of 65");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  await nav(page, "Diary & activity");
  await expect(
    page.getByRole("heading", { name: "No dated diary entries" }),
  ).toBeVisible();
  await nav(page, "Ratings");
  await expect(page.locator("body")).not.toContainText("NaN");
  await nav(page, "Taste & places");
  await expect(
    page.getByText("Metadata adds this chapter").first(),
  ).toBeVisible();
  await nav(page, "Directors & actors");
  await expect(page.getByText("Metadata adds this chapter")).toBeVisible();
});

test("imported markup is inert and a watchlist-only import stays separate from watched counts", async ({
  page,
}) => {
  const title = '<img src=x onerror="window.__injected=1">';
  const csv = 'Name,Year\n"' + title.replaceAll('"', '""') + '",2000\n';
  await page.getByRole("button", { name: "Import data", exact: true }).click();
  await page.getByLabel("Choose Letterboxd export files").setInputFiles({
    name: "watchlist.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByText("Import checked. Ready to explore."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Analyze my data", exact: true })
    .click();
  await expect(
    page.locator(".metrics").first().locator(".metric").first(),
  ).toContainText("0");
  await nav(page, "Watchlist & next picks");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__injected)).toBeUndefined();
  await expect(page.locator(".watchlist-cards img")).toHaveCount(0);
});

test("clearing always removes the current journal and credential when browser storage is blocked", async ({
  page,
}) => {
  await importFixture(page);
  await nav(page, "Data & privacy");
  await page
    .getByLabel("Your TMDB API key or read access token")
    .fill("fixture-read-token");
  await page.evaluate(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: {
        open() {
          throw new DOMException("Blocked", "SecurityError");
        },
      },
    });
  });
  await page
    .getByRole("button", { name: "Clear all imported and saved data" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Clear all data", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Every film leavesa trace.",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "previously saved copy" }),
  ).toBeVisible();
  await nav(page, "Data & privacy");
  await expect(
    page.getByLabel("Your TMDB API key or read access token"),
  ).toHaveValue("");
});
