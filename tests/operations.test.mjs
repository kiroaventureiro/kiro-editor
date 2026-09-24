import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = await mkdtemp(join(tmpdir(), "kiro-tests-"));
await build({
  entryPoints: [
    "src/editor/operations.ts",
    "src/editor/history.ts",
    "src/editor/project.ts",
  ],
  outdir: dir,
  bundle: true,
  format: "esm",
  platform: "node",
});
const op = await import(pathToFileURL(join(dir, "operations.js")));
const { historyReducer } = await import(pathToFileURL(join(dir, "history.js")));
const { createEmptyProject } = await import(
  pathToFileURL(join(dir, "project.js"))
);
const clip = {
  id: "c",
  assetId: "a",
  type: "video",
  name: "Cena",
  start: 2,
  duration: 4,
  sourceIn: 1,
  sourceOut: 5,
  speed: 1,
};
const project = () => ({
  ...createEmptyProject(),
  assets: [{ id: "a", type: "video", name: "Vídeo", path: "", duration: 8 }],
  tracks: [{ id: "t", type: "video", name: "Vídeo", clips: [clip] }],
});
test("speed preserves source span and updates timeline duration", () => {
  const c = op.changeSpeed(clip, 2);
  assert.equal(c.duration, 2);
  assert.equal(c.sourceOut, 5);
});
test("trimming cannot read beyond original file or before source zero", () => {
  const p = project();
  const end = op.trim(clip, "end", 100, p);
  assert.equal(end.sourceOut, 8);
  assert.equal(end.duration, 7);
  const start = op.trim(clip, "start", 0, p);
  assert.equal(start.start, 1);
  assert.equal(start.sourceIn, 0);
  assert.equal(start.duration, 5);
});
test("split retains source range at altered speed", () => {
  const c = op.changeSpeed(clip, 2);
  const [a, b] = op.split(c, 3);
  assert.equal(a.sourceOut, 3);
  assert.equal(b.sourceIn, 3);
  assert.equal(b.sourceOut, 5);
  assert.equal(a.duration + b.duration, 2);
});
test("ripple deletion merges overlapping intervals and respects locked tracks", () => {
  const p = project();
  p.tracks[0].clips = [
    { ...clip, id: "a", start: 0, duration: 3 },
    { ...clip, id: "b", start: 2, duration: 3 },
    { ...clip, id: "c", start: 6, duration: 1 },
  ];
  p.tracks.push({ ...p.tracks[0], id: "locked", locked: true });
  const result = op.removeClips(p, ["a", "b"], true);
  assert.equal(result.tracks[0].clips[0].start, 1);
  assert.equal(result.tracks[1].clips.length, 3);
});
test("one drag is one undo step, reducer does not mutate previous state", () => {
  const p = project(),
    s = { present: p, past: [], future: [] };
  let h = historyReducer(s, { type: "begin" });
  h = historyReducer(h, { type: "edit", project: { ...p, name: "A" } });
  h = historyReducer(h, { type: "edit", project: { ...p, name: "B" } });
  h = historyReducer(h, { type: "end" });
  assert.equal(h.past.length, 1);
  h = historyReducer(h, { type: "undo" });
  assert.equal(h.present.name, p.name);
  h = historyReducer(h, { type: "redo" });
  assert.equal(h.present.name, "B");
  assert.equal(s.past.length, 0);
});
test("SRT imports timing and plain multiline captions", () => {
  const result = op.parseSrt(
    "1\n00:00:01,000 --> 00:00:03,500\n<b>Olá</b>\nmundo\n\n2\n00:00:05,000 --> 00:00:04,000\ninválida",
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].duration, 2.5);
  assert.equal(result[0].text, "Olá\nmundo");
});
test("snapping uses closest edge and aligns to project frames", () => {
  assert.equal(op.snap(2.97, [3, 4], 0.1, 30), 3);
  assert.equal(op.snap(-1, [], 0, 30), 0);
  assert.equal(op.frameTime(1.01, 30), 1);
});
process.on("exit", () => {});
await rm(dir, { recursive: true, force: true });
