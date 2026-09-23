import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resolve } from "node:path";
const output = resolve("test-results");
await mkdir(output, { recursive: true });
const video = (color, name, freq) =>
  execFileSync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${color}:s=640x360:d=2:r=30`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${freq}:duration=2`,
    "-c:v",
    "libvpx-vp9",
    "-c:a",
    "libopus",
    "-shortest",
    `${output}/${name}.webm`,
    "-loglevel",
    "error",
  ]);
video("red", "cena-1", 440);
video("green", "cena-2", 660);
video("blue", "cena-3", 880);
execFileSync("ffmpeg", [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=220:duration=6",
  `${output}/musica.wav`,
  "-loglevel",
  "error",
]);
await writeFile(
  `${output}/legendas.srt`,
  "1\n00:00:00,500 --> 00:00:01,500\nHistória KIRO\n",
);
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4173"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4173")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    ...(process.env.KIRO_BROWSER_PATH
      ? { executablePath: process.env.KIRO_BROWSER_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByText("Salvo neste navegador", { exact: true }).waitFor();
  await page
    .getByLabel("Importar mídia", { exact: true })
    .setInputFiles(
      ["cena-1.webm", "cena-2.webm", "cena-3.webm", "musica.wav"].map(
        (f) => `${output}/${f}`,
      ),
    );
  await page.waitForFunction(
    () => document.querySelectorAll(".asset-card").length === 4,
  );
  for (const file of [
    "cena-1.webm",
    "cena-2.webm",
    "cena-3.webm",
    "musica.wav",
  ])
    await page
      .getByRole("button", { name: `Adicionar ${file}`, exact: true })
      .click();
  await page
    .getByRole("button", { name: "Reproduzir montagem", exact: true })
    .waitFor();
  await page.waitForFunction(
    () =>
      !document.querySelector('button[aria-label="Reproduzir montagem"]')
        .disabled,
  );
  const pixel = () =>
    page
      .locator("canvas")
      .evaluate((c) =>
        Array.from(
          c.getContext("2d").getImageData(c.width / 2, c.height / 2, 1, 1).data,
        ),
      );
  for (const [time, channel] of [
    [0.5, 0],
    [2.5, 1],
    [4.5, 2],
  ]) {
    await page.getByLabel("Posição em segundos").fill(String(time));
    await page.waitForFunction((ch) => {
      const c = document.querySelector("canvas");
      const p = c
        .getContext("2d")
        .getImageData(c.width / 2, c.height / 2, 1, 1).data;
      return p[ch] > 90 && p[ch] > p[(ch + 1) % 3] * 1.5;
    }, channel);
    console.log("Scrub frame", time, await pixel());
  }
  await page.getByLabel("Posição em segundos").fill("0");
  await page
    .getByRole("button", { name: "Reproduzir montagem", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector('input[aria-label="Posição em segundos"]').value,
      ) > 4.5,
    {},
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  console.log("Continuous playback passed");
  await page
    .getByLabel("Importar legendas SRT")
    .setInputFiles(`${output}/legendas.srt`);
  await page.waitForFunction(
    () => document.querySelectorAll(".clip-text").length === 1,
  );
  await page.getByLabel("Posição em segundos").fill("0.75");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.reload();
  await page.getByText("Salvo neste navegador", { exact: true }).waitFor();
  assert.equal(await page.locator(".asset-card").count(), 4);
  assert.equal(await page.locator(".missing").count(), 0);
  assert.equal(await page.locator(".clip").count(), 5);
  console.log("Media persistence after reload passed");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const downloaded = page.waitForEvent("download", { timeout: 90000 });
  await page.getByRole("button", { name: "Gerar e baixar vídeo" }).click();
  const download = await downloaded,
    file = `${output}/${download.suggestedFilename()}`;
  await download.saveAs(file);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
  console.log("Export metadata", JSON.stringify(probe));
  await writeFile(`${output}/export-probe.json`, JSON.stringify(probe, null, 2));
  assert(
    probe.streams.some(
      (s) => s.codec_type === "video" && s.width === 1280 && s.height === 720,
    ),
  );
  assert(probe.streams.some((s) => s.codec_type === "audio"));
  assert(
    Number(probe.format.duration) > 5.8 && Number(probe.format.duration) < 7.5,
  );
  for (const [time, ch] of [
    [0.25, 0],
    [2.5, 1],
    [4.5, 2],
  ]) {
    const rgb = execFileSync("ffmpeg", [
      "-v",
      "error",
      "-ss",
      String(time),
      "-i",
      file,
      "-vf",
      "scale=1:1",
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ]);
    assert(
      rgb[ch] > 80 && rgb[ch] > rgb[(ch + 1) % 3] * 1.5,
      `Export color at ${time}: ${[...rgb]}`,
    );
  }
  const pcm = execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    file,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "8000",
    "-f",
    "f32le",
    "pipe:1",
  ]);
  for (let sec = 0; sec < 6; sec++) {
    let sum = 0,
      count = 0;
    for (
      let i = sec * 8000 * 4;
      i < Math.min(pcm.length, (sec + 1) * 8000 * 4);
      i += 4
    ) {
      sum += pcm.readFloatLE(i) ** 2;
      count++;
    }
    assert(Math.sqrt(sum / count) > 0.005, `Audio silent at second ${sec}`);
  }
  console.log(
    "Export has three scenes and audible audio through all six seconds",
    probe.format.duration,
  );
  // Cancellation must not create a false successful download.
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await page.getByRole("button", { name: "Gerar e baixar vídeo" }).click();
  await page.getByRole("button", { name: "Cancelar exportação" }).click();
  await page.getByText("Exportação cancelada.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Fechar exportação" }).click();
  // Mobile layout and drawers remain usable without overflowing the viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mídia", exact: true }).click();
  await page.getByLabel("Buscar mídia").fill("cena-1");
  assert.equal(await page.locator(".asset-card").count(), 1);
  await page.getByRole("button", { name: "Mídia", exact: true }).click();
  await page.screenshot({ path: `${output}/mobile.png` });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log("Mobile and runtime error checks passed");
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "scrub across three scenes",
          "continuous playback",
          "SRT captions",
          "persistent media after reload",
          "720p video export",
          "all scenes in export",
          "audible mixed audio",
          "cancel export",
          "390px mobile layout",
        ],
        export: probe,
      },
      null,
      2,
    ),
  );
} catch (e) {
  if (browser) {
    for (const context of browser.contexts())
      for (const p of context.pages()) {
        await p.screenshot({ path: `${output}/failure.png` }).catch(() => {});
        await writeFile(`${output}/failure.html`, await p.content()).catch(
          () => {},
        );
      }
  }
  throw e;
} finally {
  await browser?.close();
  server.kill();
}
