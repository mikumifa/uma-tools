import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const distDir = path.join(repoRoot, "dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function browserCandidates() {
  const candidates = [process.env.UMA_EXPORT_BROWSER];
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env["ProgramFiles(x86)"];
    const localAppData = process.env.LOCALAPPDATA;
    candidates.push(
      programFiles && path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      programFilesX86 && path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      localAppData && path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      programFiles && path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      programFilesX86 && path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    );
  }
  return candidates.filter(Boolean);
}

function findBrowser() {
  const executablePath = browserCandidates().find((candidate) =>
    fs.existsSync(candidate),
  );
  if (!executablePath) {
    throw new Error(
      "未找到 Chrome 或 Edge。可通过 UMA_EXPORT_BROWSER 指定浏览器可执行文件。",
    );
  }
  return executablePath;
}

function createStaticServer(rootDir) {
  return http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    let relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    if (!relativePath || relativePath.endsWith("/")) {
      relativePath += "index.html";
    }
    const filePath = path.resolve(rootDir, relativePath);
    const relativeToRoot = path.relative(rootDir, filePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      response.end(content);
    });
  });
}

async function main() {
  if (!fs.existsSync(path.join(distDir, "intel", "index.html"))) {
    throw new Error("缺少 dist/intel/index.html，请先运行 npm run build。 ");
  }

  const server = createStaticServer(distDir);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  let browser;
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("无法取得临时服务器端口。 ");
    }
    browser = await chromium.launch({
      executablePath: findBrowser(),
      headless: true,
    });
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(`http://127.0.0.1:${address.port}/intel/`, {
      waitUntil: "networkidle",
    });
    const exports = [
      { selector: "#intelExportGachaTrigger", section: "gacha", label: "卡池" },
      { selector: "#intelExportEventsTrigger", section: "events", label: "活动" },
      { selector: "#intelExportRacesTrigger", section: "races", label: "大赛" },
    ];
    const date = new Date().toISOString().slice(0, 10);
    for (const item of exports) {
      await page.waitForSelector(item.selector, { state: "attached" });
      const downloadPromise = page.waitForEvent("download", {
        timeout: 120000,
      });
      await page.locator(item.selector).evaluate((element) => element.click());
      const download = await downloadPromise;
      const filename = `uma-intel-${item.section}-${date}.png`;
      const outputPath = path.join(distDir, filename);
      await download.saveAs(outputPath);
      console.log(`${item.label}一图流已生成：${outputPath}`);
    }
    await page.waitForFunction(
      () => typeof window.__exportIntelMobile === "function",
      { timeout: 120000 },
    );
    const mobileOutputDir = path.join(distDir, `xiaohongshu-${date}`);
    fs.mkdirSync(mobileOutputDir, { recursive: true });
    for (const filename of fs.readdirSync(mobileOutputDir)) {
      if (filename.toLowerCase().endsWith(".png")) {
        fs.unlinkSync(path.join(mobileOutputDir, filename));
      }
    }
    let mobileImageCount = 0;
    for (const item of exports) {
      const files = await page.evaluate(async (section) => {
        if (typeof window.__exportIntelMobile !== "function") {
          throw new Error("手机版导出器未初始化");
        }
        return window.__exportIntelMobile(section);
      }, item.section);
      for (const file of files) {
        const match = /^data:image\/png;base64,(.+)$/.exec(file.dataUrl);
        if (!match) throw new Error(`手机版图片数据无效：${file.filename}`);
        fs.writeFileSync(
          path.join(mobileOutputDir, file.filename),
          Buffer.from(match[1], "base64"),
        );
        mobileImageCount += 1;
      }
      console.log(`${item.label}手机版已生成 ${files.length} 张`);
    }
    console.log(`小红书图片共 ${mobileImageCount} 张：${mobileOutputDir}`);
    const legacyOutput = path.join(distDir, `uma-intel-${date}.png`);
    if (fs.existsSync(legacyOutput)) fs.rmSync(legacyOutput);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
