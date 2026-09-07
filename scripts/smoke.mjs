import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { join } from "node:path";

const externalBaseUrl = process.env.SMOKE_BASE_URL;
const baseUrl = externalBaseUrl || "http://127.0.0.1:51234";
const routes = ["/", "/listings", "/about", "/contact", "/testimonials", "/privacy"];
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

if (!externalBaseUrl) {
  server = spawn(
    process.execPath,
    [
      join(process.cwd(), "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "51234",
    ],
    { cwd: process.cwd(), stdio: "inherit" }
  );
  await waitForServer();
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response?.ok()) {
      throw new Error(`${route} returned ${response?.status() ?? "no response"}`);
    }
    const expectedCanonical = `https://aprilzhaohome.com${route === "/" ? "" : route}`;
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    if (canonical !== expectedCanonical) {
      throw new Error(`${route} has unexpected canonical URL: ${canonical}`);
    }
    await page.waitForTimeout(100);
  }

  await page.goto(`${baseUrl}/listings`, { waitUntil: "domcontentloaded" });
  const brokenImages = await page.locator("img").evaluateAll((images) =>
    images
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.getAttribute("src"))
  );
  if (brokenImages.length > 0) {
    throw new Error(`Broken images on /listings: ${brokenImages.join(", ")}`);
  }
  if (errors.length > 0) {
    throw new Error(`Browser errors: ${errors.join(" | ")}`);
  }

  console.log(`Smoke-tested ${routes.length} public routes successfully.`);
} finally {
  await browser.close();
  server?.kill("SIGTERM");
}
