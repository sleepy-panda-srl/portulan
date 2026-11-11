// Process interruption and ownership controls for CLI instruction migration.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { compileGuidance, run as compile } from "./compile.mjs";
import { run as instructions } from "./instructions.mjs";

const HERMETIC_HOST = fs.mkdtempSync(path.join(os.tmpdir(), "portulan-hermetic-"));
process.env.CLAUDE_CONFIG_DIR = HERMETIC_HOST;
process.on("exit", () => fs.rmSync(HERMETIC_HOST, { recursive: true, force: true }));
const roots = [];
process.on("exit", () =>
  roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })),
);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  JOURNAL = ".portulan-instructions-journal";
const original =
  "# Root policy\n\nMandatory always guidance survives exactly.\n\n## Instructions\n<!-- portulan: on-read -->\n\nEssential moved guidance.\n";
function put(root, rel, bytes) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
}
function fixture(rel = "CLAUDE.md", self = false) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "portulan-source-recovery-"),
  );
  roots.push(root);
  const ws = self ? root : path.join(root, ".portulan");
  fs.cpSync(path.join(REPO, "cli/fixtures/nested-guidance"), ws, {
    recursive: true,
  });
  fs.rmSync(path.join(ws, ".claude"), { recursive: true });
  fs.rmSync(path.join(ws, "api/CLAUDE.md"));
  const m = JSON.parse(fs.readFileSync(path.join(ws, "workspace.json")));
  m.kind = "repository";
  m.tree = self ? "./" : "../";
  fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify(m));
  compileGuidance(root);
  put(root, rel, original);
  return { root, ws, rel, args: ["--workspace", ws, "--write"] };
}
function snapshot(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((item) => {
      const file = path.join(root, item.name),
        at = fs.lstatSync(file);
      if (item.isDirectory())
        return [
          [item.name, "directory", at.mode],
          ...snapshot(file).map(([rel, ...values]) => [
            item.name + "/" + rel,
            ...values,
          ]),
        ];
      return [
        [
          item.name,
          item.isSymbolicLink() ? "link" : "file",
          at.mode,
          item.isSymbolicLink()
            ? fs.readlinkSync(file)
            : fs.readFileSync(file).toString("base64"),
        ],
      ];
    });
}
async function ready(join, rel) {
  const f = fixture(rel);
  if (join) {
    assert.equal(await instructions(f.args, () => {}), 0);
    f.args.push("--join");
  }
  return f;
}
function cut(f, phase = "claim", extra = "") {
  const target = path.join(f.root, f.rel),
    script = `import fs from 'node:fs';import {run} from ${JSON.stringify(new URL("./instructions.mjs", import.meta.url).href)};const rename=fs.renameSync,link=fs.linkSync;${extra}fs.renameSync=(from,to,...args)=>{const value=rename(from,to,...args);if(${JSON.stringify(phase)}==='claim'&&from===${JSON.stringify(target)}&&String(to).includes('.portulan-guidance-claim.'))process.kill(process.pid,'SIGKILL');return value;};fs.linkSync=(from,to,...args)=>{const value=link(from,to,...args);if(${JSON.stringify(phase)}==='link'&&to===${JSON.stringify(target)})process.kill(process.pid,'SIGKILL');return value;};process.exitCode=await run(${JSON.stringify(f.args)},()=>{});`;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(child.signal, "SIGKILL", child.stdout + child.stderr);
}
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const join of [false, true])
    test(`${join ? "join" : "split"} resumes the source claim gap for ${rel}`, async () => {
      const f = await ready(join, rel),
        oracle = fixture(rel);
      if (join) assert.equal(await instructions(oracle.args, () => {}), 0);
      assert.equal(
        await instructions(
          [...oracle.args, ...(join ? ["--join"] : [])],
          () => {},
        ),
        0,
      );
      cut(f);
      assert.equal(fs.existsSync(path.join(f.root, rel)), false);
      assert.equal(
        compile(["--workspace", f.ws, "--check"], { quiet: true }),
        2,
      );
      const before = snapshot(f.root),
        dry = f.args.filter((arg) => arg !== "--write"),
        lines = [];
      assert.equal(await instructions(dry, (line) => lines.push(line)), 2);
      assert.deepEqual(snapshot(f.root), before);
      assert.match(lines.join("\n"), /resum|interrupted|pending/i);
      assert.equal(
        await instructions(f.args, (line) => lines.push(line)),
        0,
        lines.join("\n"),
      );
      assert.match(
        fs.readFileSync(path.join(f.root, rel), "utf8"),
        /Mandatory always guidance survives exactly/,
      );
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      assert.deepEqual(snapshot(f.root), snapshot(oracle.root));
      assert.equal(compileGuidance(f.root, { check: true }).drifted, 0);
    });
for (const identical of [false, true])
  test(`recovery preserves an independently arrived ${identical ? "identical" : "changed"} root`, async () => {
    const f = await ready(false, "CLAUDE.md");
    cut(f);
    const text = identical ? original : "Human root after interruption.\n";
    put(f.root, "CLAUDE.md.human", text);
    fs.renameSync(
      path.join(f.root, "CLAUDE.md.human"),
      path.join(f.root, "CLAUDE.md"),
    );
    const at = fs.statSync(path.join(f.root, "CLAUDE.md")),
      lines = [];
    assert.equal(await instructions(f.args, (line) => lines.push(line)), 2);
    assert.equal(fs.readFileSync(path.join(f.root, "CLAUDE.md"), "utf8"), text);
    assert.equal(fs.statSync(path.join(f.root, "CLAUDE.md")).ino, at.ino);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
    assert.match(lines.join("\n"), /CLAUDE\.md|conflict|changed/);
  });
test("source journal bodies are private and block vendor and upgrade", async () => {
  const f = await ready(false, "CLAUDE.md");
  cut(f);
  const dir = path.join(f.root, JOURNAL);
  assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
  for (const entry of fs.readdirSync(dir)) {
    const at = fs.lstatSync(path.join(dir, entry));
    if (at.isFile()) assert.equal(at.mode & 0o777, 0o600);
  }
  const { run: vendor } = await import("./vendor.mjs"),
    { run: upgrade } = await import("./upgrade.mjs"),
    lines = [];
  assert.equal(
    await vendor(
      [
        f.ws,
        "--into",
        path.join(f.root, "elsewhere/.portulan"),
        "--residence",
        "in-repo",
        "--host",
        "generic",
      ],
      { say: (line) => lines.push(line), warn: (line) => lines.push(line) },
    ),
    2,
  );
  assert.equal(
    await upgrade([f.ws, "--write"], {
      say: (line) => lines.push(line),
      warn: (line) => lines.push(line),
    }),
    2,
  );
  assert.equal(fs.existsSync(path.join(f.root, "elsewhere")), false);
  assert.match(lines.join("\n"), /journal|interrupted|pending|resum/i);
});
test("a second cut during source recovery still converges", async () => {
  const f = await ready(false, "CLAUDE.md");
  cut(f);
  cut(f, "link");
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
  assert.match(
    fs.readFileSync(path.join(f.root, "CLAUDE.md"), "utf8"),
    /Mandatory always guidance survives exactly/,
  );
  assert.equal(
    fs
      .readdirSync(path.join(f.ws, "context"))
      .filter((name) => name.startsWith("instructions")).length,
    1,
  );
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
  assert.equal(compileGuidance(f.root, { check: true }).drifted, 0);
});

for (const phase of ["restored-claim", "source-stage-cleanup"])
  test(`a second SIGKILL during ${phase} leaves a provable recovery`, async () => {
    const f = fixture();
    cut(f);
    const hook = `const rename=fs.renameSync;fs.renameSync=(from,to,...args)=>{const result=rename(from,to,...args);if(String(to).includes('.portulan-guidance-claim.')&&(${JSON.stringify(phase)}==='restored-claim'?String(from).includes('.CLAUDE.md.portulan-guidance-claim.'):String(from).includes('CLAUDE.md.portulan-upgrade.')))process.kill(process.pid,'SIGKILL');return result;};`;
    killedAt(f, hook);
    const lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      0,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    assert.match(
      fs.readFileSync(path.join(f.root, f.rel), "utf8"),
      /Mandatory always guidance survives exactly/,
    );
    const leftovers = snapshot(f.root).filter(
      ([name]) =>
        name.includes("portulan-guidance") || name.includes("portulan-upgrade"),
    );
    assert.deepEqual(leftovers, []);
  });
test("a reserved unknown journal directory refuses without changing source data", async () => {
  const f = fixture(),
    dir = path.join(f.root, JOURNAL);
  fs.mkdirSync(dir);
  put(dir, "human.txt", "Human metadata.\n");
  const before = snapshot(f.root),
    lines = [];
  assert.equal(await instructions(f.args, (line) => lines.push(line)), 2);
  assert.deepEqual(snapshot(f.root), before);
  assert.match(lines.join("\n"), /journal|review|unproved|unknown/i);
});

function childScript(f, hook = "") {
  return `import fs from 'node:fs';import {run} from ${JSON.stringify(new URL("./instructions.mjs", import.meta.url).href)};${hook}process.exitCode=await run(${JSON.stringify(f.args)},line=>console.log(line));`;
}
function killedAt(f, hook) {
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", childScript(f, hook)],
    {
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(child.signal, "SIGKILL", child.stdout + child.stderr);
}
async function waitFor(file, child) {
  const deadline = Date.now() + 10000;
  while (!fs.existsSync(file)) {
    if (child.exitCode !== null)
      assert.fail(`child exited ${child.exitCode} before rendezvous`);
    assert.ok(Date.now() < deadline, "child rendezvous timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
function completed(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
}

test("a live recovery lease excludes a simultaneously started retry", async () => {
  const f = fixture();
  cut(f);
  const rendezvous = fs.mkdtempSync(
    path.join(os.tmpdir(), "portulan-recovery-rendezvous-"),
  );
  roots.push(rendezvous);
  const signal = path.join(rendezvous, "ready"),
    release = path.join(rendezvous, "release");
  const hook = `const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{if(to===${JSON.stringify(path.join(f.root, f.rel))}){fs.writeFileSync(${JSON.stringify(signal)},'ready');const end=Date.now()+10000;while(!fs.existsSync(${JSON.stringify(release)})){if(Date.now()>end)throw Error('rendezvous timed out');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}return link(from,to,...args);};`;
  const first = spawn(
    process.execPath,
    ["--input-type=module", "-e", childScript(f, hook)],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  first.stdout.on("data", (bytes) => (output += bytes));
  first.stderr.on("data", (bytes) => (output += bytes));
  const done = completed(first);
  try {
    await waitFor(signal, first);
    const second = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", childScript(f)],
      {
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.equal(second.status, 2, second.stdout + second.stderr);
    assert.match(second.stdout, /another instruction writer owns/);
  } finally {
    fs.writeFileSync(release, "release");
  }
  assert.equal(await done, 0, output);
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
  assert.equal(
    fs
      .readdirSync(path.join(f.ws, "context"))
      .filter((name) => name.startsWith("instructions")).length,
    1,
  );
});

test("a recovery killed after publishing its lease can be recovered again", async () => {
  const f = fixture();
  cut(f);
  killedAt(
    f,
    `const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{const result=link(from,to,...args);if(String(to).includes('/${JOURNAL}/lease-'))process.kill(process.pid,'SIGKILL');return result;};`,
  );
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
  assert.match(
    fs.readFileSync(path.join(f.root, f.rel), "utf8"),
    /Mandatory always guidance survives exactly/,
  );
});

test("an unrelated hard-link alias is preserved rather than adopted as an old stage", async () => {
  const f = fixture();
  cut(f);
  cut(f, "link");
  const alias = path.join(
    f.root,
    ".CLAUDE.md.portulan-guidance.123.00000000-0000-0000-0000-000000000000",
  );
  fs.linkSync(path.join(f.root, f.rel), alias);
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(alias), true);
  assert.equal(fs.readFileSync(alias, "utf8"), original);
  assert.match(lines.join("\n"), /unproved alias/);
});

for (const phase of ["stage", "claim"])
  test(`a cut after publishing a ${phase} record preserves its prepared source`, async () => {
    const f = fixture();
    killedAt(
      f,
      `const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{const result=link(from,to,...args);if(String(to).includes('/${JOURNAL}/${phase}-'))process.kill(process.pid,'SIGKILL');return result;};`,
    );
    const lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      0,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    assert.equal(compileGuidance(f.root, { check: true }).drifted, 0);
  });

test("private instruction bodies have private source stages from their first open", async (t) => {
  const f = fixture();
  fs.chmodSync(path.join(f.root, f.rel), 0o600);
  let checked = 0;
  const open = fs.openSync;
  t.mock.method(fs, "openSync", (file, flags, mode, ...args) => {
    if (
      typeof file === "string" &&
      [
        path.join(f.root, f.rel),
        path.join(f.ws, "context/instructions.md"),
      ].some((source) => file.startsWith(source + ".portulan-upgrade."))
    ) {
      assert.equal(mode & 0o077, 0);
      checked++;
    }
    return open(file, flags, mode, ...args);
  });
  assert.equal(await instructions(f.args, () => {}), 0);
  assert.ok(checked > 0);
  assert.equal(
    fs.statSync(path.join(f.ws, "context/instructions.md")).mode & 0o777,
    0o600,
  );
});

test("consistent fabricated next bytes cannot replace the actual split proof", async () => {
  const f = fixture();
  cut(f);
  const dir = path.join(f.root, JOURNAL),
    ownerFile = path.join(dir, "owner.json"),
    owner = JSON.parse(fs.readFileSync(ownerFile));
  owner.inputs.find((input) => input.file === f.rel).next =
    "Fabricated policy replaces unrelated guidance.\n";
  const encoded = JSON.stringify(owner, null, 2) + "\n",
    hash = createHash("sha256").update(encoded).digest("hex");
  fs.writeFileSync(ownerFile, encoded);
  for (const name of fs.readdirSync(dir))
    if (/^(?:(?:undo-)?(?:stage|claim)|retired)-/.test(name)) {
      const file = path.join(dir, name),
        record = JSON.parse(fs.readFileSync(file));
      record.owner = hash;
      if (record.phase === "stage" && record.data.file === f.rel)
        fs.writeFileSync(
          path.join(f.root, record.data.path),
          owner.inputs[record.index].next,
        );
      fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
    }
  const lines = [];
  assert.equal(await instructions(f.args, (line) => lines.push(line)), 2);
  assert.match(lines.join("\n"), /not the proved split or join/);
  assert.equal(fs.readFileSync(path.join(f.root, f.rel), "utf8"), original);
  assert.equal(fs.existsSync(dir), true);
});

test("a changed held original is returned and retained without authorizing replay", async () => {
  const f = fixture();
  cut(f);
  const dir = path.join(f.root, JOURNAL),
    record = fs
      .readdirSync(dir)
      .filter((name) => name.startsWith("claim-"))
      .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name))))
      .find((record) => record.data.file === f.rel);
  const changed = "Human save made to the actual claimed entry.\n";
  fs.writeFileSync(path.join(f.root, record.data.path), changed);
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.readFileSync(path.join(f.root, f.rel), "utf8"), changed);
  assert.equal(fs.existsSync(dir), true);
});

for (const join of [false, true])
  test(`multi-root ${join ? "join" : "split"} retains the original operation across a second failure`, async () => {
    const f = fixture(".claude/CLAUDE.md"),
      oracle = fixture(".claude/CLAUDE.md");
    const two =
      original +
      "\n## Further instructions\n<!-- portulan: on-read -->\n\nSecond conserved guidance section.\n";
    for (const item of [f, oracle]) {
      put(item.root, "CLAUDE.md", two);
      fs.chmodSync(path.join(item.root, "CLAUDE.md"), 0o600);
      if (join) assert.equal(await instructions(item.args, () => {}), 0);
    }
    if (join) {
      f.args.push("--join");
      oracle.args.push("--join");
    }
    assert.equal(await instructions(oracle.args, () => {}), 0);
    cut(f);
    const lines = [];
    let failed = false;
    const write = (file, bytes) => {
      if (
        String(file).includes(".claude/rules/portulan/on-read.md") &&
        !failed
      ) {
        failed = true;
        throw Error("persistent guidance refusal");
      }
      fs.writeFileSync(file, bytes);
    };
    assert.equal(
      await instructions(f.args, (line) => lines.push(line), { write }),
      2,
      lines.join("\n"),
    );
    assert.equal(failed, true);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
    assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 2);
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), snapshot(oracle.root));
    assert.equal(
      fs.statSync(path.join(f.root, "CLAUDE.md")).mode & 0o777,
      0o600,
    );
  });

for (const point of [
  "initializer",
  "owner",
  "terminal",
  "lease-cleanup",
  "owner-cleanup",
  "terminal-cleanup",
])
  test(`a process cut at ${point} preserves original or committed source bodies`, async () => {
    const f = fixture();
    if (point === "lease-cleanup") {
      cut(f);
    }
    const hook = `const mkdir=fs.mkdirSync,link=fs.linkSync,rename=fs.renameSync;fs.mkdirSync=(file,...args)=>{const result=mkdir(file,...args);if(${JSON.stringify(point)}==='initializer'&&String(file).endsWith('/${JOURNAL}'))process.kill(process.pid,'SIGKILL');return result;};fs.linkSync=(from,to,...args)=>{const result=link(from,to,...args);if(${JSON.stringify(point)}==='owner'&&String(to).endsWith('/${JOURNAL}/owner.json'))process.kill(process.pid,'SIGKILL');if(${JSON.stringify(point)}==='terminal'&&String(to).endsWith('/${JOURNAL}/terminal.json'))process.kill(process.pid,'SIGKILL');return result;};fs.renameSync=(from,to,...args)=>{const result=rename(from,to,...args);if(String(from).includes('/${JOURNAL}/')&&String(to).includes('.portulan-guidance-claim.')){const name=String(from).split('/').at(-1);if((${JSON.stringify(point)}==='lease-cleanup'&&name.startsWith('lease-'))||(${JSON.stringify(point)}==='owner-cleanup'&&name==='owner.json')||(${JSON.stringify(point)}==='terminal-cleanup'&&name==='terminal.json'))process.kill(process.pid,'SIGKILL');}return result;};`;
    killedAt(f, hook);
    const before = fs.readFileSync(path.join(f.root, f.rel), "utf8"),
      lines = [];
    const code = await instructions(f.args, (line) => lines.push(line));
    if (point === "initializer") {
      assert.equal(code, 2);
      assert.equal(before, original);
      assert.equal(fs.readFileSync(path.join(f.root, f.rel), "utf8"), original);
      assert.match(lines.join("\n"), /unproved initializer/);
    } else {
      assert.equal(code, 0, lines.join("\n"));
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      assert.match(
        fs.readFileSync(path.join(f.root, f.rel), "utf8"),
        /Mandatory always guidance survives exactly/,
      );
      assert.equal(compileGuidance(f.root, { check: true }).drifted, 0);
    }
  });

for (const join of [false, true])
  test(`a late source chmod survives shared ${join ? "retirement" : "replacement"}`, async (t) => {
    const f = await ready(join, "CLAUDE.md"),
      target = join
        ? path.join(f.ws, "context/instructions.md")
        : path.join(f.root, f.rel);
    const body = fs.readFileSync(target),
      rename = fs.renameSync;
    let fired = false;
    t.mock.method(fs, "renameSync", (from, to, ...args) => {
      if (
        !fired &&
        from === target &&
        String(to).includes(".portulan-guidance-claim.")
      ) {
        fs.chmodSync(from, 0o600);
        fired = true;
      }
      return rename(from, to, ...args);
    });
    const lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      2,
      lines.join("\n"),
    );
    assert.equal(fired, true);
    assert.deepEqual(fs.readFileSync(target), body);
    assert.equal(fs.statSync(target).mode & 0o777, 0o600);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  });

test("an unrecorded complete recovery stage retains the journal and names its review path", async () => {
  const f = fixture("CLAUDE.md", true);
  cut(f);
  const hook = `const open=fs.openSync,chmod=fs.fchmodSync;let stage;fs.openSync=(file,...args)=>{const fd=open(file,...args);if(typeof file==='string'&&file.startsWith(${JSON.stringify(path.join(f.root, f.rel) + ".portulan-upgrade.")}))stage=fd;return fd;};fs.fchmodSync=(fd,...args)=>{const result=chmod(fd,...args);if(fd===stage)process.kill(process.pid,'SIGKILL');return result;};`;
  killedAt(f, hook);
  const recorded = new Set(
    fs
      .readdirSync(path.join(f.root, JOURNAL))
      .filter((name) => /^(?:(?:undo-)?(?:stage|claim)|retired)-/.test(name))
      .map(
        (name) =>
          JSON.parse(fs.readFileSync(path.join(f.root, JOURNAL, name))).data
            .path,
      ),
  );
  const residue = fs
    .readdirSync(f.root)
    .find(
      (name) =>
        name.startsWith("CLAUDE.md.portulan-upgrade.") && !recorded.has(name),
    );
  assert.ok(residue);
  const file = path.join(f.root, residue),
    body = fs.readFileSync(file),
    at = fs.statSync(file),
    lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  assert.ok(
    lines.join("\n").includes(file) ||
      lines.join("\n").includes(fs.realpathSync(file)),
    lines.join("\n"),
  );
  assert.deepEqual(fs.readFileSync(file), body);
  assert.equal(fs.statSync(file).ino, at.ino);
  assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 2);
  fs.unlinkSync(file);
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
});

for (const terminal of [false, true])
  test(`current slot bindings preserve the journal during ${terminal ? "terminal cleanup" : "recovery takeover"}`, async () => {
    const f = fixture("CLAUDE.md", true);
    if (terminal)
      killedAt(
        f,
        `const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{const result=link(from,to,...args);if(String(to).endsWith('/${JOURNAL}/terminal.json'))process.kill(process.pid,'SIGKILL');return result;};`,
      );
    else cut(f);
    const manifest = path.join(f.ws, "workspace.json"),
      m = JSON.parse(fs.readFileSync(manifest));
    m.slots.memory = JOURNAL + "/";
    fs.writeFileSync(manifest, JSON.stringify(m));
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      2,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    assert.match(lines.join("\n"), /overlap|reserved|slot/i);
  });

for (const switching of [false, true])
  test(`vendor refuses a journal arriving during inventory (${switching ? "switch" : "render"})`, async (t) => {
    const f = fixture("CLAUDE.md", true),
      box = fs.mkdtempSync(
        path.join(os.tmpdir(), "portulan-journal-vendor-dest-"),
      );
    roots.push(box);
    const dest = path.join(box, switching ? "feed" : ".portulan"),
      readdir = fs.readdirSync;
    let fired = false;
    t.mock.method(fs, "readdirSync", (dir, ...args) => {
      if (!fired && String(dir) === f.root) {
        fired = true;
        killedAt(
          f,
          `const open=fs.openSync;fs.openSync=(file,...args)=>{if(typeof file==='string'&&file.includes('.portulan-upgrade.'))process.kill(process.pid,'SIGKILL');return open(file,...args);};`,
        );
      }
      return readdir(dir, ...args);
    });
    const { run: vendor } = await import("./vendor.mjs"),
      lines = [];
    assert.equal(
      await vendor(
        [
          f.ws,
          "--into",
          dest,
          "--residence",
          switching ? "feed-side" : "in-repo",
          ...(switching
            ? ["--switch", "--leave", "nothing"]
            : ["--host", "generic"]),
        ],
        { say: (line) => lines.push(line), warn: (line) => lines.push(line) },
      ),
      2,
      lines.join("\n"),
    );
    assert.equal(fired, true);
    assert.equal(fs.existsSync(path.join(dest, JOURNAL)), false);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL, "owner.json")), true);
    assert.equal(fs.existsSync(path.join(f.ws, "workspace.json")), true);
  });

test("the source proof excludes unrelated context bodies and keeps a small split bounded", async () => {
  const f = fixture();
  for (const name of ["unrelated-a", "unrelated-b"])
    put(
      f.ws,
      "context/" + name + ".md",
      "---\ntier: on-read\ndescription: Unrelated body.\n---\n\n" +
        "x".repeat(11 * 1024 * 1024) +
        "\n",
    );
  cut(f);
  const owner = JSON.parse(
    fs.readFileSync(path.join(f.root, JOURNAL, "owner.json")),
  );
  assert.deepEqual(owner.reads.map((row) => row.file).sort(), [
    ".claude/CLAUDE.md",
    "CLAUDE.md",
  ]);
  assert.ok(fs.statSync(path.join(f.root, JOURNAL, "owner.json")).size < 10000);
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
  assert.match(
    fs.readFileSync(path.join(f.root, f.rel), "utf8"),
    /Mandatory always guidance survives exactly/,
  );
});

for (const switching of [false, true])
  for (const point of [1, 2])
    test(`vendor refuses a newly pending operation before ${point === 1 ? "publication" : "governance retirement"} (${switching ? "switch" : "render"})`, async () => {
      const f = fixture("CLAUDE.md", true),
        box = fs.mkdtempSync(
          path.join(os.tmpdir(), "portulan-journal-vendor-late-"),
        );
      roots.push(box);
      const dest = path.join(box, switching ? "feed" : ".portulan"),
        lines = [];
      let calls = 0,
        fired = false;
      const options = {
        say: (line) => lines.push(line),
        warn: (line) => lines.push(line),
        get faultAt() {
          if (++calls === point) {
            fired = true;
            killedAt(
              f,
              `const open=fs.openSync;fs.openSync=(file,...args)=>{if(typeof file==='string'&&file.includes('.portulan-upgrade.'))process.kill(process.pid,'SIGKILL');return open(file,...args);};`,
            );
          }
          return undefined;
        },
      };
      const { run: vendor } = await import("./vendor.mjs");
      assert.equal(
        await vendor(
          [
            f.ws,
            "--into",
            dest,
            "--residence",
            switching ? "feed-side" : "in-repo",
            ...(switching
              ? ["--switch", "--leave", "nothing"]
              : ["--host", "generic"]),
          ],
          options,
        ),
        2,
        lines.join("\n"),
      );
      assert.equal(fired, true);
      assert.equal(fs.existsSync(path.join(dest, JOURNAL)), false);
      assert.equal(fs.existsSync(path.join(dest, "workspace.json")), false);
      assert.equal(fs.existsSync(path.join(f.ws, "workspace.json")), true);
      assert.equal(
        fs.existsSync(path.join(f.root, JOURNAL, "owner.json")),
        true,
      );
    });

for (const join of [false, true])
  test(`rollback preserves a private published ${join ? "joined" : "split"} root and its unit`, async () => {
    const f = await ready(join, "CLAUDE.md"),
      file = path.join(f.root, f.rel),
      unit = path.join(f.ws, "context/instructions.md"),
      lines = [];
    let fired = false,
      postImage,
      identity;
    const write = (stage, bytes, options) => {
      if (!fired && String(stage).includes("on-read.md.portulan-upgrade.")) {
        fs.chmodSync(file, 0o600);
        postImage = fs.readFileSync(file);
        identity = fs.statSync(file).ino;
        fired = true;
        throw Object.assign(Error("failed after private save"), {
          code: "EIO",
        });
      }
      return fs.writeFileSync(stage, bytes, options);
    };
    assert.equal(
      await instructions(f.args, (line) => lines.push(line), { write }),
      2,
      lines.join("\n"),
    );
    assert.equal(fired, true);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(fs.statSync(file).ino, identity);
    assert.deepEqual(fs.readFileSync(file), postImage);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
    assert.equal(fs.existsSync(unit), true);
    assert.match(fs.readFileSync(unit, "utf8"), /Essential moved guidance/);
    assert.match(lines.join("\n"), /INCOMPLETE|retained/);
  });

test("rollback removal preserves the mode of a newly created human-changed file", async () => {
  const f = fixture(),
    { applyEdits, restore } = await import("./upgrade.mjs"),
    file = path.join(f.ws, "new.txt");
  const applied = applyEdits(f.ws, [
    { file: "new.txt", before: null, next: "Created content.\n" },
  ]);
  assert.equal(applied.ok, true);
  fs.chmodSync(file, 0o600);
  const back = restore(f.ws, applied.snapshots);
  assert.equal(back.ok, false);
  assert.equal(fs.readFileSync(file, "utf8"), "Created content.\n");
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("successive rollback publications retain their own mode rather than adopting a later chmod", async (t) => {
  const f = fixture(),
    { applyEdits, restore } = await import("./upgrade.mjs"),
    file = path.join(f.ws, "repeat.txt");
  put(f.ws, "repeat.txt", "start");
  const applied = applyEdits(f.ws, [
    { file: "repeat.txt", before: "start", next: "middle" },
    { file: "repeat.txt", before: "middle", next: "end" },
  ]);
  assert.equal(applied.ok, true);
  const lstat = fs.lstatSync;
  let fired = false;
  t.mock.method(fs, "lstatSync", (name, ...args) => {
    if (!fired && name === file && fs.readFileSync(file, "utf8") === "middle") {
      fs.chmodSync(file, 0o600);
      fired = true;
    }
    return lstat(name, ...args);
  });
  const back = restore(f.ws, applied.snapshots);
  assert.equal(fired, true);
  assert.equal(back.ok, false);
  assert.equal(fs.readFileSync(file, "utf8"), "middle");
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

for (const consumer of ["native", "split"])
  test(`a chmod during nested preparation survives ${consumer} publication`, async (t) => {
    const f = fixture(),
      target = path.join(f.root, "api/CLAUDE.md"),
      before = fs.readFileSync(target),
      unit = path.join(f.ws, "context/api.md");
    fs.appendFileSync(unit, "\nA changed nested body.\n");
    const open = fs.openSync;
    let fired = false;
    t.mock.method(fs, "openSync", (name, flags, ...args) => {
      if (
        !fired &&
        flags === "wx" &&
        String(name).startsWith(
          path.join(f.root, "api/.CLAUDE.md.portulan-guidance."),
        )
      ) {
        fs.chmodSync(target, 0o600);
        fired = true;
      }
      return open(name, flags, ...args);
    });
    const lines = [];
    const code =
      consumer === "native"
        ? compile(["--workspace", f.ws], { quiet: true })
        : await instructions(f.args, (line) => lines.push(line));
    assert.equal(code, 2, lines.join("\n"));
    assert.equal(fired, true);
    assert.equal(fs.statSync(target).mode & 0o777, 0o600);
    assert.deepEqual(fs.readFileSync(target), before);
  });

test("native retirement retains the mode observed before its guarded claim", async (t) => {
  const f = fixture(),
    { applyNestedEdits } = await import("./guidance-files.mjs"),
    file = path.join(f.root, "retired.md");
  put(f.root, "retired.md", "Owned old body.\n");
  const read = fs.readFileSync,
    physical = fs.realpathSync(file);
  let fired = false;
  t.mock.method(fs, "readFileSync", (name, ...args) => {
    const bytes = read(name, ...args);
    if (!fired && (name === file || name === physical)) {
      fs.chmodSync(file, 0o600);
      fired = true;
    }
    return bytes;
  });
  assert.throws(
    () =>
      applyNestedEdits(f.root, [
        { file: "retired.md", before: "Owned old body.\n", next: null },
      ]),
    /changed/,
  );
  assert.equal(fired, true);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(file, "utf8"), "Owned old body.\n");
});

for (const moment of ["preflight", "recovery", "publication"])
  test(`join preserves a unit newly referenced by the other root at ${moment}`, async (t) => {
    const f = await ready(true, "CLAUDE.md"),
      file = path.join(f.root, f.rel),
      before = fs.readFileSync(file),
      marker = before
        .toString()
        .split("\n")
        .find((line) => line.includes("portulan: on-read ")),
      other = path.join(f.root, ".claude/CLAUDE.md"),
      unit = path.join(f.ws, "context/instructions.md"),
      human = "# Human root\n\n" + marker + "\n",
      lines = [];
    assert.ok(marker);
    let fired = false;
    const arrive = () => {
      put(f.root, ".claude/CLAUDE.md", human);
      fired = true;
    };
    if (moment === "recovery") {
      cut(f);
      arrive();
    }
    if (moment === "publication") {
      const link = fs.linkSync;
      t.mock.method(fs, "linkSync", (from, to, ...args) => {
        const result = link(from, to, ...args);
        if (!fired && to === file) arrive();
        return result;
      });
    }
    const say = (line) => {
      lines.push(line);
      if (moment === "preflight" && !fired && line.includes("takes back"))
        arrive();
    };
    assert.equal(await instructions(f.args, say), 2, lines.join("\n"));
    assert.equal(fired, true);
    assert.equal(fs.readFileSync(other, "utf8"), human);
    assert.equal(fs.existsSync(unit), true);
    assert.match(fs.readFileSync(unit, "utf8"), /Essential moved guidance/);
    assert.equal(
      fs.existsSync(path.join(f.root, JOURNAL)),
      moment !== "preflight",
    );
    assert.deepEqual(fs.readFileSync(file), before);
  });

test("a saved operation cannot omit the other root observation", async () => {
  const f = fixture();
  cut(f);
  const dir = path.join(f.root, JOURNAL),
    ownerFile = path.join(dir, "owner.json"),
    owner = JSON.parse(fs.readFileSync(ownerFile));
  owner.reads = owner.reads.filter((row) => row.file !== ".claude/CLAUDE.md");
  const encoded = JSON.stringify(owner, null, 2) + "\n",
    hash = createHash("sha256").update(encoded).digest("hex");
  fs.writeFileSync(ownerFile, encoded);
  for (const name of fs
    .readdirSync(dir)
    .filter((name) => /^(?:(?:undo-)?(?:stage|claim)|retired)-/.test(name))) {
    const file = path.join(dir, name),
      record = JSON.parse(fs.readFileSync(file));
    record.owner = hash;
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  }
  const before = snapshot(f.root),
    lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.deepEqual(snapshot(f.root), before);
  assert.match(lines.join("\n"), /root|read set|planning/i);
});

function cutGuidance(f, consumer, hook) {
  const module = new URL(
    consumer === "native" ? "./compile.mjs" : "./instructions.mjs",
    import.meta.url,
  ).href;
  const args = consumer === "native" ? ["--workspace", f.ws] : f.args;
  const script = `import fs from 'node:fs';import {run} from ${JSON.stringify(module)};${hook}process.exitCode=await run(${JSON.stringify(args)},${consumer === "native" ? "{quiet:true}" : "()=>{}"});`;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.equal(child.signal, "SIGKILL", child.stdout + child.stderr);
}
function privateTargetGap(consumer) {
  const f = fixture(),
    target = path.join(f.root, "api/CLAUDE.md");
  fs.chmodSync(target, 0o600);
  fs.appendFileSync(
    path.join(f.ws, "context/api.md"),
    "\nA recovered private body.\n",
  );
  cutGuidance(
    f,
    consumer,
    `const rename=fs.renameSync;fs.renameSync=(from,to,...args)=>{const result=rename(from,to,...args);if(from===${JSON.stringify(target)}&&String(to).includes('.portulan-guidance-claim.'))process.kill(process.pid,'SIGKILL');return result;};`,
  );
  assert.equal(fs.existsSync(target), false);
  return { ...f, target };
}
async function resumeGuidance(f, consumer, lines = []) {
  return consumer === "native"
    ? compile(["--workspace", f.ws], { quiet: true })
    : await instructions(f.args, (line) => lines.push(line));
}
for (const consumer of ["native", "split"])
  for (const repeated of [false, true])
    test(`${consumer} keeps private target permissions after ${repeated ? "a recovery cleanup cut" : "the original claim cut"}`, async () => {
      const f = privateTargetGap(consumer);
      if (repeated) {
        const witnesses = fs
          .readdirSync(path.dirname(f.target))
          .filter((name) => name.startsWith(".CLAUDE.md.portulan-guidance"))
          .map((name) => path.join(path.dirname(f.target), name));
        assert.ok(witnesses.length >= 2);
        cutGuidance(
          f,
          consumer,
          `const unlink=fs.unlinkSync,rename=fs.renameSync,files=${JSON.stringify(witnesses)},moved=new Set();fs.renameSync=(from,to,...args)=>{const result=rename(from,to,...args);if(files.includes(String(from)))moved.add(String(to));return result;};fs.unlinkSync=(file,...args)=>{const result=unlink(file,...args);if(moved.has(String(file))&&moved.size===files.length&&files.every(name=>!fs.existsSync(name))&&[...moved].every(name=>!fs.existsSync(name)))process.kill(process.pid,'SIGKILL');return result;};`,
        );
      }
      const lines = [];
      assert.equal(
        await resumeGuidance(f, consumer, lines),
        0,
        lines.join("\n"),
      );
      assert.equal(fs.statSync(f.target).mode & 0o777, 0o600);
      assert.match(
        fs.readFileSync(f.target, "utf8"),
        /A recovered private body/,
      );
      assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    });
for (const consumer of ["native", "split"])
  test(`${consumer} refuses disagreeing retained target permissions`, async () => {
    const f = privateTargetGap(consumer),
      dir = path.dirname(f.target),
      witness = fs
        .readdirSync(dir)
        .find((name) => name.startsWith(".CLAUDE.md.portulan-guidance-claim."));
    fs.chmodSync(path.join(dir, witness), 0o644);
    const before = snapshot(path.dirname(f.target)),
      lines = [];
    assert.equal(await resumeGuidance(f, consumer, lines), 2, lines.join("\n"));
    assert.equal(fs.existsSync(f.target), false);
    assert.deepEqual(snapshot(path.dirname(f.target)), before);
    if (consumer === "split")
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  });
for (const consumer of ["native", "split"])
  test(`${consumer} keeps permission evidence through a renamed-source registry transition`, async () => {
    const f = privateTargetGap(consumer);
    fs.renameSync(
      path.join(f.ws, "context/api.md"),
      path.join(f.ws, "context/service.md"),
    );
    cutGuidance(
      f,
      consumer,
      `const link=fs.linkSync;fs.linkSync=(from,to,...args)=>{const result=link(from,to,...args);if(String(to).endsWith('/.claude/rules/portulan/.instructions')&&fs.readFileSync(to,'utf8').includes('context/service.md'))process.kill(process.pid,'SIGKILL');return result;};`,
    );
    const lines = [];
    assert.equal(await resumeGuidance(f, consumer, lines), 0, lines.join("\n"));
    assert.equal(fs.statSync(f.target).mode & 0o777, 0o600);
    assert.match(fs.readFileSync(f.target, "utf8"), /context\/service\.md/);
    assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
  });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const recovered of [false, true])
    for (const moment of ["root-publication", "unit-retirement"])
      test(`${recovered ? "resumed" : "initial"} join keeps an operand-root reference at ${moment} (${rel})`, async (t) => {
        const f = await ready(true, rel),
          file = path.join(f.root, rel),
          unit = path.join(f.ws, "context/instructions.md"),
          marker = fs
            .readFileSync(file, "utf8")
            .split("\n")
            .find((line) => line.includes("portulan: on-read ")),
          human = "# Independent saved root\n\n" + marker + "\n",
          lines = [];
        assert.ok(marker);
        if (recovered) cut(f);
        let fired = false;
        const arrive = () => {
          put(f.root, rel + ".editor", human);
          fs.renameSync(path.join(f.root, rel + ".editor"), file);
          fired = true;
        };
        if (moment === "root-publication") {
          const link = fs.linkSync;
          t.mock.method(fs, "linkSync", (from, to, ...args) => {
            const value = link(from, to, ...args);
            if (
              !fired &&
              to === file &&
              fs.readFileSync(file, "utf8").includes("Essential moved guidance")
            )
              arrive();
            return value;
          });
        } else {
          const unlink = fs.unlinkSync;
          t.mock.method(fs, "unlinkSync", (name, ...args) => {
            const value = unlink(name, ...args);
            if (
              !fired &&
              String(name).startsWith(
                path.join(
                  f.ws,
                  "context/.instructions.md.portulan-guidance-claim.",
                ),
              ) &&
              !fs.existsSync(unit)
            )
              arrive();
            return value;
          });
        }
        assert.equal(
          await instructions(f.args, (line) => lines.push(line)),
          2,
          lines.join("\n"),
        );
        assert.equal(fired, true);
        assert.equal(fs.readFileSync(file, "utf8"), human);
        assert.equal(fs.existsSync(unit), true);
        assert.match(fs.readFileSync(unit, "utf8"), /Essential moved guidance/);
        assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
        assert.equal(
          await instructions(f.args, (line) => lines.push(line)),
          2,
          lines.join("\n"),
        );
        assert.equal(fs.existsSync(unit), true);
        assert.equal(fs.readFileSync(file, "utf8"), human);
      });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`a second kill after confirmed retirement conserves a human-root reference (${rel})`, async () => {
    const f = await ready(true, rel),
      file = path.join(f.root, rel),
      unit = path.join(f.ws, "context/instructions.md"),
      marker = fs
        .readFileSync(file, "utf8")
        .split("\n")
        .find((line) => line.includes("portulan: on-read ")),
      human = "# Saved while retiring\n\n" + marker + "\n";
    cut(f);
    killedAt(
      f,
      `const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(file + ".editor")},${JSON.stringify(human)});fs.renameSync(${JSON.stringify(file + ".editor")},${JSON.stringify(file)});process.kill(process.pid,'SIGKILL');}return value;};`,
    );
    const lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.readFileSync(file, "utf8"), human);
    assert.equal(fs.existsSync(unit), true);
    assert.match(fs.readFileSync(unit, "utf8"), /Essential moved guidance/);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  });

test("a retirement confirmation without its acquired-source intent cannot recreate a unit", async () => {
  const f = await ready(true, "CLAUDE.md"),
    file = path.join(f.root, f.rel),
    unit = path.join(f.ws, "context/instructions.md"),
    marker = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .find((line) => line.includes("portulan: on-read "));
  cut(f);
  killedAt(
    f,
    `const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(file + ".editor")},${JSON.stringify("# Human root\n" + marker + "\n")});fs.renameSync(${JSON.stringify(file + ".editor")},${JSON.stringify(file)});process.kill(process.pid,'SIGKILL');}return value;};`,
  );
  const dir = path.join(f.root, JOURNAL),
    records = fs
      .readdirSync(dir)
      .filter((name) => /^(?:claim|retired)-/.test(name))
      .map((name) => ({
        name,
        value: JSON.parse(fs.readFileSync(path.join(dir, name))),
      })),
    confirmed = records.find((row) => row.value.phase === "retired"),
    intent = records.find(
      (row) =>
        row.value.phase === "claim" &&
        row.value.data.path === confirmed.value.data.path,
    );
  assert.ok(intent);
  fs.unlinkSync(path.join(dir, intent.name));
  const before = snapshot(f.root),
    lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(unit), false);
  assert.deepEqual(snapshot(f.root), before);
});

test("a joined unit cannot retire while its published body retains its own moved reference", async () => {
  const f = await ready(true, "CLAUDE.md"),
    file = path.join(f.root, f.rel),
    unit = path.join(f.ws, "context/instructions.md"),
    before = fs.readFileSync(file),
    marker = before
      .toString()
      .split("\n")
      .find((line) => line.includes("portulan: on-read "));
  fs.appendFileSync(unit, "\n" + marker + "\n");
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(unit), true);
  assert.deepEqual(fs.readFileSync(file), before);
});

test("split rollback preserves a new unit referenced by an arriving second root", async (t) => {
  const f = fixture(),
    unit = path.join(f.ws, "context/instructions.md"),
    { movedMark, unitDigest } = await import("./instructions.mjs"),
    link = fs.linkSync;
  let fired = false,
    human;
  t.mock.method(fs, "linkSync", (from, to, ...args) => {
    const value = link(from, to, ...args);
    if (!fired && to === unit) {
      human =
        "# New reference\n" +
        movedMark(
          path.relative(f.root, unit).split(path.sep).join("/"),
          unitDigest(fs.readFileSync(unit, "utf8")),
        ) +
        "\n";
      put(f.root, ".claude/CLAUDE.md", human);
      fired = true;
    }
    return value;
  });
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fired, true);
  assert.equal(fs.existsSync(unit), true);
  assert.equal(
    fs.readFileSync(path.join(f.root, ".claude/CLAUDE.md"), "utf8"),
    human,
  );
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
});

test("a kill during split rollback restores a unit newly referenced by the second root", async () => {
  const f = fixture(),
    unit = path.join(f.ws, "context/instructions.md"),
    file = path.join(f.root, f.rel),
    other = path.join(f.root, ".claude/CLAUDE.md"),
    href = new URL("./instructions.mjs", import.meta.url).href;
  killedAt(
    f,
    `const {movedMark,unitDigest}=await import(${JSON.stringify(href)});const open=fs.openSync,link=fs.linkSync,unlink=fs.unlinkSync;let marker;fs.linkSync=(from,to,...args)=>{const value=link(from,to,...args);if(to===${JSON.stringify(unit)})marker=movedMark(${JSON.stringify(path.relative(f.root, unit).split(path.sep).join("/"))},unitDigest(fs.readFileSync(to,'utf8')));return value;};fs.openSync=(name,...args)=>{if(String(name).startsWith(${JSON.stringify(file + ".portulan-upgrade.")}))throw Object.assign(Error('source refusal'),{code:'EIO'});return open(name,...args);};fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(marker&&String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(other)},'# New reference\\n'+marker+'\\n');process.kill(process.pid,'SIGKILL');}return value;};`,
  );
  const human = fs.readFileSync(other),
    lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(unit), true);
  assert.deepEqual(fs.readFileSync(other), human);
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
});

for (const importer of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`join preserves a direct native import from ${importer}`, async () => {
    const f = await ready(true, "CLAUDE.md"),
      unit = path.join(f.ws, "context/instructions.md"),
      file = path.join(f.root, importer),
      line =
        "@" +
        path.relative(path.dirname(file), unit).split(path.sep).join("/") +
        "\n";
    fs.appendFileSync(file, "\n" + line);
    const { alwaysTier } = await import("./context.mjs"),
      measured = () =>
        alwaysTier(f.root).entries.some(
          (entry) =>
            entry.label === "import, depth 1" &&
            fs.realpathSync(entry.file) === fs.realpathSync(unit),
        );
    assert.equal(measured(), true);
    const before = fs.readFileSync(file),
      lines = [];
    assert.equal(
      await instructions(f.args, (message) => lines.push(message)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(unit), true);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.equal(measured(), true);
  });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const example of ["fenced", "inline"])
    test(`${example} native import examples stay literal for ${rel}`, async () => {
      const f = await ready(true, rel),
        unit = path.join(f.ws, "context/instructions.md"),
        target = path
          .relative(path.dirname(path.join(f.root, rel)), unit)
          .split(path.sep)
          .join("/"),
        literal =
          example === "fenced"
            ? "```text\n@" + target + "\n```\n"
            : "`@" + target + "`\n";
      fs.appendFileSync(path.join(f.root, rel), "\n" + literal);
      const lines = [];
      assert.equal(
        await instructions(f.args, (message) => lines.push(message)),
        0,
        lines.join("\n"),
      );
      assert.equal(fs.existsSync(unit), false);
      assert.ok(
        fs.readFileSync(path.join(f.root, rel), "utf8").includes(literal),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`a confirmed retired unit survives a direct-import save and second kill for ${rel}`, async () => {
    const f = await ready(true, rel),
      file = path.join(f.root, rel),
      unit = path.join(f.ws, "context/instructions.md"),
      human =
        "# Native imported source\n@./" +
        path.relative(path.dirname(file), unit).split(path.sep).join("/") +
        "\n";
    cut(f);
    killedAt(
      f,
      `const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(file + ".editor")},${JSON.stringify(human)});fs.renameSync(${JSON.stringify(file + ".editor")},${JSON.stringify(file)});process.kill(process.pid,'SIGKILL');}return value;};`,
    );
    const lines = [];
    assert.equal(
      await instructions(f.args, (message) => lines.push(message)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(unit), true);
    assert.equal(fs.readFileSync(file, "utf8"), human);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`split rollback preserves a native import in the arriving other root after ${rel}`, async (t) => {
    const f = fixture(rel),
      unit = path.join(f.ws, "context/instructions.md"),
      other = path.join(
        f.root,
        rel === "CLAUDE.md" ? ".claude/CLAUDE.md" : "CLAUDE.md",
      ),
      human =
        "# Import retained\n@" +
        path.relative(path.dirname(other), unit).split(path.sep).join("/") +
        "\n",
      link = fs.linkSync;
    let fired = false;
    t.mock.method(fs, "linkSync", (from, to, ...args) => {
      const value = link(from, to, ...args);
      if (!fired && to === unit) {
        fs.writeFileSync(other, human);
        fired = true;
      }
      return value;
    });
    const lines = [];
    assert.equal(
      await instructions(f.args, (message) => lines.push(message)),
      2,
      lines.join("\n"),
    );
    assert.equal(fired, true);
    assert.equal(fs.existsSync(unit), true);
    assert.equal(fs.readFileSync(other, "utf8"), human);
    assert.equal(
      await instructions(f.args, (message) => lines.push(message)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(unit), true);
  });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const alias of ["symlink", "hardlink"])
    test(`an initially ${alias} other root refuses before journaling (${rel})`, async () => {
      const f = fixture(rel),
        other = path.join(
          f.root,
          rel === "CLAUDE.md" ? ".claude/CLAUDE.md" : "CLAUDE.md",
        ),
        ordinary = path.join(f.root, "ordinary-policy.md");
      put(f.root, "ordinary-policy.md", "# Ordinary unchanged policy.\n");
      if (alias === "symlink")
        fs.symlinkSync(path.relative(path.dirname(other), ordinary), other);
      else fs.linkSync(ordinary, other);
      assert.equal(
        compile(["--workspace", f.ws, "--check"], { quiet: true }),
        0,
      );
      const before = snapshot(f.root),
        lines = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        assert.equal(
          await instructions(f.args, (message) => lines.push(message)),
          2,
          lines.join("\n"),
        );
        assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
        assert.deepEqual(snapshot(f.root), before);
        assert.equal(
          compile(["--workspace", f.ws, "--check"], { quiet: true }),
          0,
        );
      }
    });
test("an initially hardlinked original unit refuses before a join journal is created", async () => {
  const f = await ready(true, "CLAUDE.md"),
    unit = path.join(f.ws, "context/instructions.md");
  fs.linkSync(unit, path.join(f.root, "unit-copy.md"));
  assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 0);
  const before = snapshot(f.root),
    lines = [];
  assert.equal(
    await instructions(f.args, (message) => lines.push(message)),
    2,
    lines.join("\n"),
  );
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
  assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 0);
});
test("a normalized self-reference in a joined unit remains a live reference", async () => {
  const f = await ready(true, "CLAUDE.md"),
    unit = path.join(f.ws, "context/instructions.md"),
    file = path.join(f.root, f.rel),
    marker = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .find((line) => line.includes("portulan: on-read "));
  fs.appendFileSync(
    unit,
    "\n" + marker.replace("on-read .portulan/", "on-read ./.portulan/") + "\n",
  );
  const lines = [];
  assert.equal(
    await instructions(f.args, (message) => lines.push(message)),
    2,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(unit), true);
});

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["file", "directory"])
    test(`missing direct imports resolve through ${kind} aliases for ${rel}`, async () => {
      const f = await ready(true, rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/instructions.md"),
        alias = path.join(
          f.root,
          kind === "file" ? "unit-alias.md" : "unit-aliases",
        );
      fs.symlinkSync(
        path.relative(
          path.dirname(alias),
          kind === "file" ? unit : path.dirname(unit),
        ),
        alias,
        kind === "directory" ? "dir" : "file",
      );
      const named =
          kind === "file" ? alias : path.join(alias, "instructions.md"),
        human =
          "# Aliased direct import\n@" +
          path.relative(path.dirname(file), named).split(path.sep).join("/") +
          "\n";
      cut(f);
      killedAt(
        f,
        `const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(file + ".editor")},${JSON.stringify(human)});fs.renameSync(${JSON.stringify(file + ".editor")},${JSON.stringify(file)});process.kill(process.pid,'SIGKILL');}return value;};`,
      );
      const lines = [];
      assert.equal(
        await instructions(f.args, (message) => lines.push(message)),
        2,
        lines.join("\n"),
      );
      assert.equal(fs.existsSync(unit), true);
      assert.equal(fs.readFileSync(file, "utf8"), human);
      assert.equal(fs.realpathSync(named), fs.realpathSync(unit));
    });

for (const kind of ["root", "unit"])
  test(`an initially aliased ${kind} parent refuses before journaling`, async () => {
    const f =
        kind === "unit" ? await ready(true, "CLAUDE.md") : fixture("CLAUDE.md"),
      parent =
        kind === "unit"
          ? path.join(f.ws, "context")
          : path.join(f.root, ".claude"),
      saved = parent + "-saved";
    fs.renameSync(parent, saved);
    fs.symlinkSync(path.basename(saved), parent, "dir");
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(f.args, (message) => lines.push(message)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    assert.deepEqual(snapshot(f.root), before);
  });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const site of ["surviving", "other", "moved"])
    test(`preview checks split import reachability (${rel}, ${site})`, async () => {
      const f = fixture(rel),
        unit = path.join(f.ws, "context/instructions.md"),
        root = path.join(f.root, rel),
        other = path.join(
          f.root,
          rel === "CLAUDE.md" ? ".claude/CLAUDE.md" : "CLAUDE.md",
        ),
        importer = site === "other" ? other : root;
      const target = site === "moved" ? path.join(f.root, "detail.md") : unit;
      put(
        f.root,
        "detail.md",
        "Imported detail survives in its original file.\n",
      );
      const line =
        "@" +
        path
          .relative(path.dirname(importer), target)
          .split(path.sep)
          .join("/") +
        "\n";
      if (site === "other") fs.writeFileSync(importer, line);
      else if (site === "moved") fs.appendFileSync(root, "\n" + line);
      else
        fs.writeFileSync(
          root,
          fs
            .readFileSync(root, "utf8")
            .replace(
              "Mandatory always guidance survives exactly.",
              "Mandatory always guidance survives exactly.\n" + line,
            ),
        );
      const before = snapshot(f.root),
        preview = [],
        applied = [];
      if (site === "moved") {
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (x) => preview.push(x),
          ),
          2,
          preview.join("\n"),
        );
        assert.match(preview.join("\n"), /imports .*loads into every context/);
        assert.deepEqual(snapshot(f.root), before);
        assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
        return;
      }
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (x) => preview.push(x),
        ),
        0,
        preview.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      const predicted = preview
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(predicted, preview.join("\n"));
      assert.equal(
        await instructions(f.args, (x) => applied.push(x)),
        0,
        applied.join("\n"),
      );
      assert.ok(
        applied.some((line) => line.includes("always tier goes from")),
        applied.join("\n"),
      );
      const { alwaysTier } = await import("./context.mjs"),
        bytes = alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0);
      assert.equal(Number(predicted[1].replaceAll(",", "")), bytes);
      assert.ok(
        applied.some((line) =>
          line.includes(bytes.toLocaleString("en-US") + " B"),
        ),
        applied.join("\n"),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const example of ["fenced", "inline"])
    test(`preview retains a precise split forecast for ${example} import examples (${rel})`, async () => {
      const f = fixture(rel),
        root = path.join(f.root, rel),
        target = path
          .relative(
            path.dirname(root),
            path.join(f.ws, "context/instructions.md"),
          )
          .split(path.sep)
          .join("/"),
        literal =
          example === "fenced"
            ? "```text\n@" + target + "\n```"
            : "`@" + target + "`";
      fs.writeFileSync(
        root,
        fs
          .readFileSync(root, "utf8")
          .replace(
            "Mandatory always guidance survives exactly.",
            "Mandatory always guidance survives exactly.\n" + literal,
          ),
      );
      const lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        0,
        lines.join("\n"),
      );
      const match = lines
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(match, lines.join("\n"));
      assert.equal(await instructions(f.args, () => {}), 0);
      const { alwaysTier } = await import("./context.mjs");
      assert.equal(
        Number(match[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const site of ["root", "unit", "other"])
    test(`preview refuses a join leaving a direct import (${rel}, ${site})`, async () => {
      const f = await ready(true, rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/instructions.md"),
        other = path.join(
          f.root,
          rel === "CLAUDE.md" ? ".claude/CLAUDE.md" : "CLAUDE.md",
        ),
        importer = site === "other" ? other : file;
      fs.appendFileSync(
        site === "unit" ? unit : importer,
        "\n@" +
          path
            .relative(path.dirname(importer), unit)
            .split(path.sep)
            .join("/") +
          "\n",
      );
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        2,
        lines.join("\n"),
      );
      assert.match(
        lines.join("\n"),
        /still references|would load into every context/,
      );
      assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["symlink", "hardlink"])
    test(`preview refuses an initially ${kind} second root (${rel})`, async () => {
      const f = fixture(rel),
        other = path.join(
          f.root,
          rel === "CLAUDE.md" ? ".claude/CLAUDE.md" : "CLAUDE.md",
        ),
        ordinary = path.join(f.root, "ordinary.md");
      put(f.root, "ordinary.md", "# Ordinary policy.\n");
      if (kind === "symlink")
        fs.symlinkSync(path.relative(path.dirname(other), ordinary), other);
      else fs.linkSync(ordinary, other);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        2,
        lines.join("\n"),
      );
      assert.match(lines.join("\n"), /singly linked/);
      assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    });
test("preview refuses a hardlinked original unit before offering a join", async () => {
  const f = await ready(true, "CLAUDE.md"),
    unit = path.join(f.ws, "context/instructions.md");
  fs.linkSync(unit, path.join(f.root, "unit-copy.md"));
  const before = snapshot(f.root),
    lines = [];
  assert.equal(
    await instructions(
      f.args.filter((x) => x !== "--write"),
      (line) => lines.push(line),
    ),
    2,
    lines.join("\n"),
  );
  assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
});

for (const kind of ["eager", "scoped", "indirect"])
  test(`preview measures a ${kind} rule importing the future split unit`, async () => {
    const f = fixture(),
      unit = path.join(f.ws, "context/instructions.md"),
      rule = path.join(f.root, ".claude/rules/future.md"),
      bridge = path.join(f.root, "bridge.md");
    const line =
      "@" +
      path
        .relative(path.dirname(rule), kind === "indirect" ? bridge : unit)
        .split(path.sep)
        .join("/") +
      "\n";
    put(
      f.root,
      ".claude/rules/future.md",
      (kind === "scoped" ? '---\npaths: ["api/**"]\n---\n' : "") + line,
    );
    if (kind === "indirect")
      put(
        f.root,
        "bridge.md",
        "@" + path.relative(f.root, unit).split(path.sep).join("/") + "\n",
      );
    const { alwaysTier } = await import("./context.mjs");
    assert.ok(alwaysTier(f.root).missing.length > 0);
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    const predicted = lines
      .join("\n")
      .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
    assert.ok(predicted, lines.join("\n"));
    assert.equal(await instructions(f.args, () => {}), 0);
    assert.equal(
      Number(predicted[1].replaceAll(",", "")),
      alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
    );
    assert.ok(
      alwaysTier(f.root).entries.some(
        (entry) => fs.realpathSync(entry.file) === fs.realpathSync(unit),
      ),
    );
  });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of [
    "two-units",
    "existing-unit",
    "leads-changed",
    "leads-refused",
    "index-import",
  ])
    test(`prospective split agrees with generated guidance (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/conventions.md");
      let text = original;
      if (kind === "two-units")
        text +=
          "\n@second.md\n\n## Second\n<!-- portulan: on-read -->\n\nSecond moved section.\n";
      if (kind === "existing-unit")
        fs.appendFileSync(
          path.join(f.ws, "context/history.md"),
          "\n@instructions.md\n",
        );
      if (kind.startsWith("leads-")) {
        text = text.replace(
          "Essential moved guidance.",
          "- **First.** A description.",
        );
        if (kind === "leads-changed")
          text +=
            "\n## Elsewhere\n\n- **A later, substantially different lead.** Retained background.\n";
        fs.appendFileSync(
          unit,
          "\n<!-- leads: " +
            path.relative(path.dirname(unit), file).split(path.sep).join("/") +
            " -->\n",
        );
      }
      if (kind === "index-import") {
        text = text.replace(
          "## Instructions",
          "## Instructions @../../../policy.md",
        );
        put(
          f.root,
          "policy.md",
          "Additional guidance loaded by the final index.\n",
        );
      }
      fs.writeFileSync(file, text);
      compileGuidance(f.ws);
      const before = snapshot(f.root),
        lines = [],
        refusal = ["two-units", "existing-unit", "leads-refused"].includes(
          kind,
        );
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        refusal ? 2 : 0,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      if (refusal) {
        assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
        return;
      }
      const forecast = lines
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(forecast, lines.join("\n"));
      assert.equal(await instructions(f.args, () => {}), 0);
      const { alwaysTier } = await import("./context.mjs");
      assert.equal(
        Number(forecast[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["import", "leads"])
    test(`prospective join rejects a dependent always unit (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        file = path.join(f.root, rel);
      fs.writeFileSync(
        file,
        original.replace(
          "Essential moved guidance.",
          "- **First.** Moved guidance.",
        ),
      );
      assert.equal(await instructions(f.args, () => {}), 0);
      const unit = path.join(f.ws, "context/conventions.md");
      fs.appendFileSync(
        unit,
        kind === "import"
          ? "\n@instructions.md\n"
          : "\n<!-- leads: instructions.md -->\n",
      );
      compileGuidance(f.ws);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          [...f.args.filter((x) => x !== "--write"), "--join"],
          (line) => lines.push(line),
        ),
        2,
        lines.join("\n"),
      );
      assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    });

for (const work of [".", ".portulan", "team"])
  test(`prospective source migration preserves ${work} workspace layout and modes`, async () => {
    const f = fixture("CLAUDE.md", work === "."),
      old = f.ws,
      ws = work === "team" ? path.join(f.root, "team") : old;
    if (work === "team") {
      fs.rmSync(path.join(f.root, ".claude"), { recursive: true });
      fs.rmSync(path.join(f.root, "api/CLAUDE.md"));
      fs.renameSync(old, ws);
    }
    const manifest = path.join(ws, "workspace.json"),
      m = JSON.parse(fs.readFileSync(manifest));
    m.slots.context = "custom/units/";
    fs.mkdirSync(path.join(ws, "custom"));
    fs.renameSync(path.join(ws, "context"), path.join(ws, m.slots.context));
    fs.writeFileSync(manifest, JSON.stringify(m));
    compileGuidance(ws);
    const file = path.join(f.root, "CLAUDE.md"),
      target = path.join(f.root, "api/CLAUDE.md");
    fs.chmodSync(file, 0o444);
    fs.chmodSync(target, 0o444);
    put(f.root, "AGENTS.md", Buffer.from([255, 10]));
    const args = ["--workspace", ws];
    for (const flags of [[], ["--join"]]) {
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions([...args, ...flags], (line) => lines.push(line)),
        0,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(
        await instructions([...args, ...flags, "--write"], (line) =>
          lines.push(line),
        ),
        0,
        lines.join("\n"),
      );
      assert.equal(fs.statSync(file).mode & 0o777, 0o444);
      assert.equal(fs.statSync(target).mode & 0o777, 0o444);
    }
    assert.equal(
      fs.readFileSync(file, "utf8"),
      original.replace("<!-- portulan: on-read -->\n", ""),
    );
  });
for (const kind of ["file", "directory", "absolute"])
  test(`prospective split preserves a ${kind} native import`, async () => {
    const f = fixture(),
      file = path.join(f.root, f.rel),
      unit = path.join(f.ws, "context/instructions.md");
    let named = unit;
    if (kind !== "absolute") {
      named = path.join(f.root, "future-alias");
      fs.symlinkSync(
        path.relative(f.root, kind === "file" ? unit : path.dirname(unit)),
        named,
        kind === "file" ? "file" : "dir",
      );
      if (kind === "directory") named = path.join(named, "instructions.md");
    }
    fs.writeFileSync(
      file,
      original.replace(
        "Mandatory always guidance survives exactly.",
        "Mandatory always guidance survives exactly.\n@" +
          (kind === "absolute" ? named : path.relative(f.root, named)),
      ),
    );
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    const match = lines
      .join("\n")
      .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
    if (kind === "absolute")
      assert.match(lines.join("\n"), /after forecast is unavailable/);
    else assert.ok(match, lines.join("\n"));
    assert.equal(await instructions(f.args, () => {}), 0);
    const { alwaysTier } = await import("./context.mjs");
    if (match)
      assert.equal(
        Number(match[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
  });

test("prospective validation masks a removed original in every import probe", async () => {
  const f = fixture(),
    removed = path.join(f.ws, "context/retired.md");
  put(
    f.root,
    ".portulan/context/retired.md",
    "---\ntier: on-read\ndescription: Retired\n---\n\nRetired text.\n",
  );
  fs.appendFileSync(path.join(f.ws, "context/history.md"), "\n@retired.md\n");
  const before = snapshot(f.root),
    { previewMigration } = await import("./init-preview.mjs");
  const result = previewMigration(f.root, f.ws, [
    { file: ".portulan/context/retired.md", next: null },
  ]);
  assert.ok(result.after);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(fs.existsSync(removed), true);
});

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const chain of [false, true])
    test(`prospective join retains a dangling source alias (${rel}, chain ${chain})`, async () => {
      const f = await ready(true, rel),
        unit = path.join(f.ws, "context/instructions.md"),
        link = path.join(f.ws, "context/linked-guidance.md");
      if (chain) {
        fs.symlinkSync(
          "instructions.md",
          path.join(f.ws, "context/intermediate.md"),
        );
        fs.symlinkSync("intermediate.md", link);
      } else fs.symlinkSync("instructions.md", link);
      compileGuidance(f.ws);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        2,
        lines.join("\n"),
      );
      assert.doesNotMatch(lines.join("\n"), /run with --write to apply/);
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      assert.equal(fs.existsSync(unit), true);
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["changed", "absent", "unchanged"])
    test(`prospective alias leads use projected bytes (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/conventions.md");
      let text = original.replace(
        "Essential moved guidance.",
        "- **First.** Moved guidance.",
      );
      if (kind === "changed")
        text +=
          "\n## Later\n\n- **Substantially longer retained lead.** More words.\n";
      if (kind === "unchanged")
        text = text.replace(
          "Mandatory always guidance survives exactly.",
          "- **Retained lead.** Always guidance.",
        );
      fs.writeFileSync(file, text);
      fs.symlinkSync(
        path.dirname(rel) === "." ? "." : ".claude",
        path.join(f.root, "alias"),
        "dir",
      );
      fs.appendFileSync(unit, "\n<!-- leads: ../../alias/CLAUDE.md -->\n");
      compileGuidance(f.ws);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        kind === "absent" ? 2 : 0,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      if (kind === "absent") {
        assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
        return;
      }
      const predicted = lines
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(predicted, lines.join("\n"));
      assert.equal(await instructions(f.args, () => {}), 0);
      const { alwaysTier } = await import("./context.mjs");
      assert.equal(
        Number(predicted[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const directive of ["leads", "gates"])
    for (const absolute of [false, true])
      test(`prospective ${directive} accepts contained ${absolute ? "absolute" : "relative"} operands (${rel})`, async () => {
        const f = fixture(rel),
          file = path.join(f.root, rel),
          unit = path.join(f.ws, "context/conventions.md");
        fs.writeFileSync(
          file,
          original.replace(
            "Essential moved guidance.",
            "- **First.** Moved guidance.",
          ) + "\n## Later\n\n- **A longer retained lead.** Details.\n",
        );
        const dependency =
          directive === "leads" ? file : path.join(f.root, "policy.json");
        if (directive === "gates")
          fs.copyFileSync(path.join(REPO, ".portulan/gates.json"), dependency);
        const operand = absolute
          ? dependency
          : path
              .relative(path.dirname(unit), dependency)
              .split(path.sep)
              .join("/");
        fs.appendFileSync(
          unit,
          "\n<!-- " + directive + ": " + operand + " -->\n",
        );
        compileGuidance(f.ws);
        const before = snapshot(f.root),
          lines = [];
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (line) => lines.push(line),
          ),
          0,
          lines.join("\n"),
        );
        assert.deepEqual(snapshot(f.root), before);
        const predicted = lines
          .join("\n")
          .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
        assert.ok(predicted, lines.join("\n"));
        assert.equal(await instructions(f.args, () => {}), 0);
        const { alwaysTier } = await import("./context.mjs");
        assert.equal(
          Number(predicted[1].replaceAll(",", "")),
          alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
        );
      });
for (const own of [false, true])
  test(`prospective engine directives preserve ${own ? "owner" : "adopter"} identity`, async () => {
    const f = fixture();
    fs.cpSync(path.join(REPO, "core"), path.join(f.root, "core"), {
      recursive: true,
    });
    if (own) {
      fs.mkdirSync(path.join(f.root, "cli"));
      for (const entry of fs.readdirSync(path.join(REPO, "cli"), {
        withFileTypes: true,
      }))
        if (entry.isFile() && entry.name.endsWith(".mjs"))
          fs.copyFileSync(
            path.join(REPO, "cli", entry.name),
            path.join(f.root, "cli", entry.name),
          );
      fs.cpSync(path.join(REPO, "spec"), path.join(f.root, "spec"), {
        recursive: true,
      });
      fs.copyFileSync(
        path.join(REPO, "package.json"),
        path.join(f.root, "package.json"),
      );
    }
    const base = own ? f.root : REPO,
      { compileGuidance: emit } = await import(
        pathToFileURL(path.join(base, "cli/compile.mjs")).href
      ),
      { run: migrate } = await import(
        pathToFileURL(path.join(base, "cli/instructions.mjs")).href
      );
    put(
      f.root,
      ".portulan/context/engine.md",
      "---\ntier: always\n---\n\n<!-- engine: operating/context.md#every-request-pays-for-what-the-session-has-read -->\n",
    );
    emit(f.ws);
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await migrate(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    const predicted = lines
      .join("\n")
      .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
    assert.ok(predicted, lines.join("\n"));
    assert.equal(await migrate(f.args, () => {}), 0);
    const { alwaysTier } = await import("./context.mjs");
    assert.equal(
      Number(predicted[1].replaceAll(",", "")),
      alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
    );
    assert.equal(
      fs
        .readFileSync(
          path.join(f.root, ".claude/rules/portulan/engine.md"),
          "utf8",
        )
        .includes("<plugin root>/"),
      !own,
    );
  });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const indirect of [false, true])
    test(`prospective aliased root imports retain edited bytes (${rel}, indirect ${indirect})`, async () => {
      const f = fixture(rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/conventions.md");
      fs.symlinkSync(
        path.dirname(rel) === "." ? "." : ".claude",
        path.join(f.root, "alias"),
        "dir",
      );
      if (indirect) {
        put(f.root, "bridge.md", "@alias/CLAUDE.md\n");
        fs.appendFileSync(unit, "\n@../../bridge.md\n");
      } else fs.appendFileSync(unit, "\n@../../alias/CLAUDE.md\n");
      compileGuidance(f.ws);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        0,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      const predicted = lines
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(predicted, lines.join("\n"));
      assert.equal(await instructions(f.args, () => {}), 0);
      const { alwaysTier } = await import("./context.mjs");
      assert.equal(
        Number(predicted[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`prospective aliased dependency cannot resurrect a retired unit (${rel})`, async () => {
    const f = await ready(true, rel),
      unit = path.join(f.ws, "context/conventions.md");
    fs.symlinkSync(".", path.join(f.ws, "context/here"), "dir");
    fs.appendFileSync(unit, "\n@here/instructions.md\n");
    compileGuidance(f.ws);
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      2,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
  });

for (const join of [false, true])
  test(`initial context-parent alias refuses without a journal (${join ? "join" : "split"})`, async () => {
    const f = join ? await ready(true, "CLAUDE.md") : fixture();
    fs.rmSync(path.join(f.ws, "context/api.md"));
    compileGuidance(f.ws);
    const dir = path.join(f.ws, "context");
    fs.renameSync(dir, dir + "-real");
    fs.symlinkSync("context-real", dir, "dir");
    compileGuidance(f.ws);
    assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 0);
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      2,
      lines.join("\n"),
    );
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      2,
      lines.join("\n"),
    );
    assert.equal(
      fs.existsSync(path.join(f.root, JOURNAL)),
      false,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    assert.equal(compile(["--workspace", f.ws, "--check"], { quiet: true }), 0);
  });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const keep of [false, true])
    test(`post-emission join checks a generated index dependency (${rel}, keep ${keep})`, async () => {
      const f = fixture(rel);
      if (!keep) fs.rmSync(path.join(f.ws, "context/history.md"));
      compileGuidance(f.ws);
      assert.equal(await instructions(f.args, () => {}), 0);
      fs.appendFileSync(
        path.join(f.ws, "context/conventions.md"),
        "\n@../../.claude/rules/portulan/on-read.md\n",
      );
      compileGuidance(f.ws);
      assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      const before = snapshot(f.root),
        lines = [],
        args = [...f.args.filter((x) => x !== "--write"), "--join"];
      assert.equal(
        await instructions(args, (line) => lines.push(line)),
        keep ? 0 : 2,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(
        await instructions([...args, "--write"], (line) => lines.push(line)),
        keep ? 0 : 2,
        lines.join("\n"),
      );
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["import-move", "leads-move", "leads-change", "stable"])
    test(`post-emission split checks an output consumer (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        api = path.join(f.ws, "context/api.md"),
        unit = path.join(f.ws, "context/conventions.md");
      fs.writeFileSync(
        api,
        fs
          .readFileSync(api, "utf8")
          .replace(
            "Validate the request at the boundary, and return the error the caller can act on.",
            "- **First generated lead.** Details.",
          ),
      );
      compileGuidance(f.ws);
      fs.appendFileSync(
        unit,
        kind === "import-move"
          ? "\n@../../api/CLAUDE.md\n"
          : "\n<!-- leads: ../../api/CLAUDE.md -->\n",
      );
      compileGuidance(f.ws);
      assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      if (kind.endsWith("move"))
        fs.writeFileSync(
          api,
          fs
            .readFileSync(api, "utf8")
            .replace("api/CLAUDE.md", "new/CLAUDE.md"),
        );
      else if (kind === "leads-change")
        fs.writeFileSync(
          api,
          fs
            .readFileSync(api, "utf8")
            .replace(
              "First generated lead.",
              "A substantially different generated lead.",
            ),
        );
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        kind === "stable" ? 0 : 2,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(
        await instructions(f.args, (line) => lines.push(line)),
        kind === "stable" ? 0 : 2,
        lines.join("\n"),
      );
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      if (kind !== "stable") assert.deepEqual(snapshot(f.root), before);
      else assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["move", "tier", "rule", "stable"])
    for (const link of ["directory", "file"])
      test(`retired output stays absent through a ${link} alias (${rel}, ${kind})`, async () => {
        const f = fixture(rel),
          file = path.join(f.root, rel),
          api = path.join(f.ws, "context/api.md"),
          old = path.join(
            f.root,
            kind === "rule"
              ? ".claude/rules/portulan/conventions.md"
              : "api/CLAUDE.md",
          ),
          alias = path.join(f.root, "output-alias");
        fs.symlinkSync(
          path.relative(f.root, link === "directory" ? path.dirname(old) : old),
          alias,
          link === "directory" ? "dir" : "file",
        );
        const named =
          link === "directory" ? path.join(alias, path.basename(old)) : alias;
        fs.writeFileSync(
          file,
          original.replace(
            "Mandatory always guidance survives exactly.",
            "Mandatory always guidance survives exactly.\n@" +
              path
                .relative(path.dirname(file), named)
                .split(path.sep)
                .join("/"),
          ),
        );
        compileGuidance(f.ws);
        if (kind === "move")
          fs.writeFileSync(
            api,
            fs
              .readFileSync(api, "utf8")
              .replace("api/CLAUDE.md", "new/CLAUDE.md"),
          );
        else if (kind === "tier")
          fs.writeFileSync(
            api,
            fs
              .readFileSync(api, "utf8")
              .replace(
                'tier: on-path\ntarget: "api/CLAUDE.md"',
                "tier: on-read",
              ),
          );
        else if (kind === "rule")
          fs.rmSync(path.join(f.ws, "context/conventions.md"));
        const before = snapshot(f.root),
          lines = [];
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (line) => lines.push(line),
          ),
          0,
          lines.join("\n"),
        );
        assert.deepEqual(snapshot(f.root), before);
        const predicted = lines
          .join("\n")
          .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
        assert.ok(predicted, lines.join("\n"));
        assert.equal(await instructions(f.args, () => {}), 0);
        const { alwaysTier } = await import("./context.mjs");
        assert.equal(
          Number(predicted[1].replaceAll(",", "")),
          alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
        );
        assert.equal(fs.existsSync(old), kind === "stable");
        assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of [
    "source-link",
    "deep",
    "two-deep",
    "duplicate",
    "indirect",
  ])
    test(`compound projected aliases retain physical parents (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        file = path.join(f.root, rel),
        unit = path.join(f.ws, "context/conventions.md"),
        nest = path.join(f.root, "one/two/three");
      fs.writeFileSync(
        file,
        original.replace(
          "Essential moved guidance.",
          "- **First moved lead.** Details.",
        ) +
          "\n## Later\n\n- **Substantially longer retained lead.** More details.\n",
      );
      fs.mkdirSync(nest, { recursive: true });
      let operand;
      if (kind === "source-link") {
        put(
          f.root,
          ".portulan/context/other.md",
          "---\ntier: on-read\ndescription: Other body\n---\n\n- **A source lead.** Details.\n",
        );
        fs.symlinkSync("other.md", path.join(f.ws, "context/linked.md"));
        fs.symlinkSync(".portulan/context", path.join(f.root, "alias"), "dir");
        operand = "../../alias/linked.md";
      } else {
        fs.symlinkSync("one/two/three", path.join(f.root, "alias"), "dir");
        fs.symlinkSync(path.relative(nest, file), path.join(nest, "input.md"));
        operand = "../../alias/input.md";
        if (kind === "two-deep") {
          const inner = path.join(f.root, "other/deep/mapped");
          fs.mkdirSync(inner, { recursive: true });
          fs.symlinkSync(
            path.relative(nest, inner),
            path.join(nest, "again"),
            "dir",
          );
          fs.symlinkSync(
            path.relative(inner, file),
            path.join(inner, "input.md"),
          );
          operand = "../../alias/again/input.md";
        }
        if (kind === "duplicate") {
          fs.symlinkSync(
            "one/two/three",
            path.join(f.root, "alternate"),
            "dir",
          );
          fs.appendFileSync(
            unit,
            "\n<!-- leads: ../../alternate/input.md -->\n",
          );
        }
        if (kind === "indirect") {
          put(f.root, "bridge.md", "@alias/input.md\n");
          operand = "../../bridge.md";
        }
      }
      fs.appendFileSync(
        unit,
        kind === "indirect"
          ? "\n@" + operand + "\n"
          : "\n<!-- leads: " + operand + " -->\n",
      );
      compileGuidance(f.ws);
      assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      const before = snapshot(f.root),
        lines = [];
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        0,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      const predicted = lines
        .join("\n")
        .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
      assert.ok(predicted, lines.join("\n"));
      assert.equal(await instructions(f.args, () => {}), 0);
      const { alwaysTier } = await import("./context.mjs");
      assert.equal(
        Number(predicted[1].replaceAll(",", "")),
        alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
      );
    });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["ordinary", "symlink", "missing"])
    for (const required of [false, true])
      test(`optional native missing-parent behavior stays distinct from required input (${rel}, ${kind}, required ${required})`, async () => {
        const f = fixture(rel),
          file = path.join(f.root, rel),
          parent = path.join(f.root, "probe-parent");
        if (kind !== "missing") {
          put(f.root, "ordinary.txt", "An ordinary file.\n");
          if (kind === "ordinary")
            fs.renameSync(path.join(f.root, "ordinary.txt"), parent);
          else fs.symlinkSync("ordinary.txt", parent);
        }
        const target = path.join(parent, "missing.md");
        if (required)
          fs.appendFileSync(
            path.join(f.ws, "context/conventions.md"),
            "\n@" +
              path
                .relative(path.join(f.ws, "context"), target)
                .split(path.sep)
                .join("/") +
              "\n",
          );
        else
          fs.writeFileSync(
            file,
            original.replace(
              "Mandatory always guidance survives exactly.",
              "Mandatory always guidance survives exactly.\n@" +
                path
                  .relative(path.dirname(file), target)
                  .split(path.sep)
                  .join("/"),
            ),
          );
        const before = snapshot(f.root),
          lines = [];
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (line) => lines.push(line),
          ),
          required ? 2 : 0,
          lines.join("\n"),
        );
        assert.deepEqual(snapshot(f.root), before);
        if (required) {
          assert.equal(
            await instructions(f.args, (line) => lines.push(line)),
            2,
          );
          assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
          assert.deepEqual(snapshot(f.root), before);
          return;
        }
        const predicted = lines
          .join("\n")
          .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
        assert.ok(predicted, lines.join("\n"));
        assert.equal(await instructions(f.args, () => {}), 0);
        const { alwaysTier } = await import("./context.mjs");
        assert.equal(
          Number(predicted[1].replaceAll(",", "")),
          alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
        );
      });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  test(`retired reference recovery resolves file links from their physical parent (${rel})`, async () => {
    const f = await ready(true, rel),
      file = path.join(f.root, rel),
      unit = path.join(f.ws, "context/instructions.md"),
      nest = path.join(f.root, "one/two/three");
    fs.mkdirSync(nest, { recursive: true });
    fs.symlinkSync(path.relative(nest, unit), path.join(nest, "input.md"));
    fs.symlinkSync("one/two/three", path.join(f.root, "recovery-alias"), "dir");
    fs.chmodSync(unit, 0o600);
    const human =
      "# New native reference\n@" +
      path
        .relative(
          path.dirname(file),
          path.join(f.root, "recovery-alias/input.md"),
        )
        .split(path.sep)
        .join("/") +
      "\n";
    cut(f);
    killedAt(
      f,
      `const unlink=fs.unlinkSync;fs.unlinkSync=(name,...args)=>{const value=unlink(name,...args);if(String(name).startsWith(${JSON.stringify(path.join(f.ws, "context/.instructions.md.portulan-guidance-claim."))})&&!fs.existsSync(${JSON.stringify(unit)})){fs.writeFileSync(${JSON.stringify(file + ".editor")},${JSON.stringify(human)});fs.renameSync(${JSON.stringify(file + ".editor")},${JSON.stringify(file)});process.kill(process.pid,'SIGKILL');}return value;};`,
    );
    const lines = [];
    assert.equal(
      await instructions(f.args, (line) => lines.push(line)),
      2,
      lines.join("\n"),
    );
    assert.equal(fs.existsSync(unit), true, lines.join("\n"));
    assert.equal(fs.statSync(unit).mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(file, "utf8"), human);
    assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), true);
  });
test("non-always missing-file probes and join use the same portable absence boundary", async () => {
  const f = fixture();
  put(f.root, "ordinary.txt", "An ordinary file.\n");
  fs.appendFileSync(
    path.join(f.ws, "context/history.md"),
    "\n@../../ordinary.txt/missing.md\n",
  );
  assert.equal(compileGuidance(f.ws, { check: true }).declared, true);
  const lines = [];
  assert.equal(
    await instructions(f.args, (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
  fs.appendFileSync(
    path.join(f.ws, "context/instructions.md"),
    "\n@../../ordinary.txt/missing.md\n",
  );
  assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
  assert.equal(
    await instructions([...f.args, "--join"], (line) => lines.push(line)),
    0,
    lines.join("\n"),
  );
  assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
});

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const product of ["nested", "rule"])
    for (const spelling of ["canonical", "parent", "leaf"])
      for (const retire of [false, true])
        test(`late lookup preserves original entry identity (${rel}, ${product}, ${spelling}, retire ${retire})`, async () => {
          const f = fixture(rel),
            api = path.join(f.ws, "context/api.md"),
            history = path.join(f.ws, "context/history.md");
          let name =
            product === "nested"
              ? "api/CLAUDE.md"
              : ".claude/rules/portulan/conventions.md";
          if (spelling === "parent")
            name =
              product === "nested"
                ? "API/CLAUDE.md"
                : ".CLAUDE/rules/portulan/conventions.md";
          if (spelling === "leaf")
            name =
              product === "nested"
                ? "api/claude.md"
                : ".claude/rules/portulan/Conventions.md";
          const route = path
            .relative(
              path.join(f.root, ".claude/rules/portulan"),
              path.join(f.root, name),
            )
            .split(path.sep)
            .join("/");
          if (retire) {
            if (product === "nested")
              fs.writeFileSync(
                api,
                fs
                  .readFileSync(api, "utf8")
                  .replace("api/CLAUDE.md", "next/CLAUDE.md"),
              );
            else fs.rmSync(path.join(f.ws, "context/conventions.md"));
          }
          fs.writeFileSync(
            history,
            fs
              .readFileSync(history, "utf8")
              .replace(
                "description: Why the service is split the way it is. Read it before restructuring it.",
                'description: "History @' + route + '"',
              ),
          );
          const before = snapshot(f.root),
            lines = [];
          assert.equal(
            await instructions(
              f.args.filter((x) => x !== "--write"),
              (line) => lines.push(line),
            ),
            0,
            lines.join("\n"),
          );
          assert.deepEqual(snapshot(f.root), before);
          const predicted = lines
            .join("\n")
            .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
          assert.ok(predicted, lines.join("\n"));
          assert.equal(await instructions(f.args, () => {}), 0);
          const { alwaysTier } = await import("./context.mjs");
          assert.equal(
            Number(predicted[1].replaceAll(",", "")),
            alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
          );
          assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
        });
for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const join of [false, true])
    for (const kind of [
      "directory",
      "directory-link",
      "compound-dangling",
      "long",
      "regular",
      "dangling",
    ])
      test(`optional native leaf lookup matches the reader (${rel}, join ${join}, ${kind})`, async () => {
        const f = join ? await ready(true, rel) : fixture(rel),
          file = path.join(f.root, rel),
          dir = path.dirname(file),
          input = path.join(dir, "optional-input.md");
        fs.mkdirSync(path.join(dir, "bucket"));
        let name = "optional-input.md";
        if (kind === "directory") name = "bucket";
        else if (kind === "directory-link")
          fs.symlinkSync("bucket", input, "dir");
        else if (kind === "compound-dangling") {
          put(
            f.root,
            path.relative(f.root, path.join(dir, "ordinary.txt")),
            "An ordinary file.\n",
          );
          fs.symlinkSync("ordinary.txt/missing.md", input);
        } else if (kind === "long")
          fs.writeFileSync(input, "@" + "a".repeat(400) + ".md\n");
        else if (kind === "regular")
          fs.writeFileSync(input, "A regular native input.\n");
        else fs.symlinkSync("absent.md", input);
        fs.writeFileSync(
          file,
          fs
            .readFileSync(file, "utf8")
            .replace(
              "Mandatory always guidance survives exactly.",
              "Mandatory always guidance survives exactly.\n@" + name,
            ),
        );
        compileGuidance(f.ws);
        assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
        const before = snapshot(f.root),
          lines = [];
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (line) => lines.push(line),
          ),
          0,
          lines.join("\n"),
        );
        assert.deepEqual(snapshot(f.root), before);
        const predicted = join
          ? null
          : lines
              .join("\n")
              .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
        if (!join) assert.ok(predicted, lines.join("\n"));
        assert.equal(await instructions(f.args, () => {}), 0);
        const { alwaysTier } = await import("./context.mjs");
        if (predicted)
          assert.equal(
            Number(predicted[1].replaceAll(",", "")),
            alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
          );
        assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      });
for (const separateParents of [false, true])
  test(`original directory entries keep distinct hard links (${separateParents})`, async () => {
    const f = fixture(),
      one = path.join(f.root, separateParents ? "first/data.md" : "first.md"),
      two = path.join(f.root, separateParents ? "second/data.md" : "second.md");
    put(
      f.root,
      path.relative(f.root, one),
      "Distinct import entries retain their bytes.\n",
    );
    fs.mkdirSync(path.dirname(two), { recursive: true });
    fs.linkSync(one, two);
    fs.writeFileSync(
      path.join(f.root, f.rel),
      original.replace(
        "Mandatory always guidance survives exactly.",
        "Mandatory always guidance survives exactly.\n@" +
          path.relative(f.root, one) +
          "\n@" +
          path.relative(f.root, two),
      ),
    );
    const before = snapshot(f.root),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(snapshot(f.root), before);
    const predicted = lines
      .join("\n")
      .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
    assert.ok(predicted);
    assert.equal(await instructions(f.args, () => {}), 0);
    const { alwaysTier } = await import("./context.mjs");
    assert.equal(
      Number(predicted[1].replaceAll(",", "")),
      alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
    );
  });
test("original entry observation needs no directory-list permission", async () => {
  const f = fixture(),
    dir = path.join(f.root, "known-input"),
    file = path.join(dir, "data.md");
  put(f.root, "known-input/data.md", "A known readable input.\n");
  fs.writeFileSync(
    path.join(f.root, f.rel),
    original.replace(
      "Mandatory always guidance survives exactly.",
      "Mandatory always guidance survives exactly.\n@known-input/data.md",
    ),
  );
  fs.chmodSync(dir, 0o111);
  try {
    const rootBefore = fs.readFileSync(path.join(f.root, f.rel)),
      lines = [];
    assert.equal(
      await instructions(
        f.args.filter((x) => x !== "--write"),
        (line) => lines.push(line),
      ),
      0,
      lines.join("\n"),
    );
    assert.deepEqual(fs.readFileSync(path.join(f.root, f.rel)), rootBefore);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o111);
    const predicted = lines
      .join("\n")
      .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
    assert.ok(predicted);
    assert.equal(await instructions(f.args, () => {}), 0);
    const { alwaysTier } = await import("./context.mjs");
    assert.equal(
      Number(predicted[1].replaceAll(",", "")),
      alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
    );
    assert.equal(fs.readFileSync(file, "utf8"), "A known readable input.\n");
  } finally {
    fs.chmodSync(dir, 0o755);
  }
});

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const kind of ["index", "remove-rule", "unchanged-rule"])
    test(`prospective physical output checks preserve linked entries (${rel}, ${kind})`, async () => {
      const f = fixture(rel),
        target = path.join(
          f.root,
          ".claude/rules/portulan",
          kind === "index" ? "on-read.md" : "conventions.md",
        ),
        backup = path.join(f.root, "output-backup.md"),
        bytes = fs.readFileSync(target);
      fs.linkSync(target, backup);
      if (kind === "remove-rule")
        fs.rmSync(path.join(f.ws, "context/conventions.md"));
      const before = snapshot(f.root),
        lines = [],
        ok = kind === "unchanged-rule";
      assert.equal(
        await instructions(
          f.args.filter((x) => x !== "--write"),
          (line) => lines.push(line),
        ),
        ok ? 0 : 2,
        lines.join("\n"),
      );
      assert.deepEqual(snapshot(f.root), before);
      assert.equal(
        await instructions(f.args, (line) => lines.push(line)),
        ok ? 0 : 2,
        lines.join("\n"),
      );
      if (!ok) assert.deepEqual(snapshot(f.root), before);
      assert.deepEqual(fs.readFileSync(backup), bytes);
      assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
    });
for (const kind of ["index", "rule"])
  test(`native publication preserves another link to its ${kind} output`, () => {
    const f = fixture(),
      target = path.join(
        f.root,
        ".claude/rules/portulan",
        kind === "index" ? "on-read.md" : "conventions.md",
      ),
      backup = path.join(f.root, "output-backup.md");
    fs.linkSync(target, backup);
    const source = path.join(
      f.ws,
      "context",
      kind === "index" ? "history.md" : "conventions.md",
    );
    fs.writeFileSync(
      source,
      fs
        .readFileSync(source, "utf8")
        .replace(
          "description: Why the service is split the way it is. Read it before restructuring it.",
          "description: Revised history",
        ) + "\nChanged curated guidance.\n",
    );
    const before = snapshot(f.root);
    assert.throws(() => compileGuidance(f.ws), /link|ordinary/i);
    assert.deepEqual(snapshot(f.root), before);
  });

for (const entry of ["guidance", "cli", "cli-policy"])
  for (const action of ["retire", "owed"])
    for (const linked of [true, false])
      test(`native marker preflight preserves the whole tree (${entry}, ${action}, linked ${linked})`, () => {
        const f = fixture();
        if (entry === "cli-policy")
          fs.copyFileSync(
            path.join(REPO, ".portulan/gates.json"),
            path.join(f.ws, "gates.json"),
          );
        const target = path.join(f.root, ".claude/rules/portulan/.compiled"),
          backup = path.join(f.root, "marker-copy.txt");
        if (linked) fs.linkSync(target, backup);
        else fs.copyFileSync(target, backup);
        fs.rmSync(path.join(f.ws, "context/history.md"));
        if (action === "retire")
          fs.rmSync(path.join(f.ws, "context/conventions.md"));
        const before = snapshot(f.root),
          saved = fs.readFileSync(backup);
        if (entry !== "guidance") {
          for (const [flag, status] of [
            ["--check", 1],
            ["--matrix", 0],
          ]) {
            const read = spawnSync(
              process.execPath,
              [
                path.join(REPO, "cli/compile.mjs"),
                "--workspace",
                f.ws,
                "--pack-root",
                path.join(REPO, "packs"),
                flag,
              ],
              { encoding: "utf8" },
            );
            assert.equal(read.status, status, read.stdout + read.stderr);
            assert.deepEqual(snapshot(f.root), before);
          }
        }
        if (entry === "guidance") {
          if (linked)
            assert.throws(() => compileGuidance(f.ws), /link|ordinary/i);
          else compileGuidance(f.ws);
        } else {
          const child = spawnSync(
            process.execPath,
            [
              path.join(REPO, "cli/compile.mjs"),
              "--workspace",
              f.ws,
              "--pack-root",
              path.join(REPO, "packs"),
            ],
            { encoding: "utf8" },
          );
          assert.equal(
            child.status,
            linked ? 2 : 0,
            child.stdout + child.stderr,
          );
        }
        assert.deepEqual(fs.readFileSync(backup), saved);
        if (linked) assert.deepEqual(snapshot(f.root), before);
        else assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
      });

for (const policy of [false, true])
  for (const linked of [true, false])
    test(`ordinary guidance preflight precedes persona publication (policy ${policy}, linked ${linked})`, () => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "portulan-native-persona-"),
      );
      roots.push(root);
      fs.cpSync(path.join(REPO, "cli/fixtures/personas"), root, {
        recursive: true,
      });
      const ws = path.join(root, "workspace"),
        agent = path.join(root, ".claude/agents/local-worker.md");
      fs.mkdirSync(path.dirname(agent), { recursive: true });
      fs.copyFileSync(path.join(root, "agents/local-worker.md"), agent);
      fs.cpSync(
        path.join(REPO, "cli/fixtures/nested-guidance/context"),
        path.join(ws, "context"),
        { recursive: true },
      );
      const mp = path.join(ws, "workspace.json"),
        m = JSON.parse(fs.readFileSync(mp));
      m.slots.context = "context/";
      if (!policy) {
        delete m.gates;
        fs.rmSync(path.join(ws, "gates.json"));
      }
      fs.writeFileSync(mp, JSON.stringify(m));
      compileGuidance(ws);
      const target = path.join(root, ".claude/rules/portulan/conventions.md"),
        backup = path.join(root, "separate-rule.md");
      if (linked) fs.linkSync(target, backup);
      else fs.copyFileSync(target, backup);
      fs.appendFileSync(
        path.join(ws, "context/conventions.md"),
        "\nChanged curated guidance.\n",
      );
      const before = snapshot(root),
        saved = fs.readFileSync(backup),
        child = spawnSync(
          process.execPath,
          [
            path.join(REPO, "cli/compile.mjs"),
            "--workspace",
            ws,
            "--pack-root",
            path.join(REPO, "packs"),
          ],
          { encoding: "utf8" },
        );
      assert.equal(child.status, linked ? 2 : 0, child.stdout + child.stderr);
      assert.deepEqual(fs.readFileSync(backup), saved);
      if (linked) assert.deepEqual(snapshot(root), before);
      else
        assert.deepEqual(
          fs.readFileSync(agent),
          fs.readFileSync(path.join(root, "golden/local-worker.md")),
        );
    });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const join of [false, true])
    for (const kind of [
      "on-read-long",
      "on-invoke-long",
      "scoped-long",
      "native-relative-long",
      "native-absolute-long",
      "outside-directory",
      "outside-missing",
      "outside-reentry",
      "reentry-missing",
      "inside",
      "short-absent",
    ])
      test(`optional projection membership follows the real reader (${rel}, join ${join}, ${kind})`, async () => {
        const f = await ready(join, rel),
          dir = path.dirname(path.join(f.root, rel));
        const long = "a".repeat(400) + ".md";
        if (kind === "on-read-long")
          fs.appendFileSync(
            path.join(f.ws, "context/history.md"),
            "\n@" + long + "\n",
          );
        else if (kind === "on-invoke-long" || kind === "scoped-long")
          put(
            f.ws,
            "context/optional.md",
            `---\ntier: ${kind === "on-invoke-long" ? "on-invoke" : 'on-path\npaths: ["src/**"]'}\ndescription: Optional native probe\n---\n\n@${long}\n`,
          );
        else {
          let operand;
          if (kind.startsWith("outside") || kind === "reentry-missing") {
            const outer = fs.mkdtempSync(
              path.join(os.tmpdir(), "portulan-optional-outside-"),
            );
            roots.push(outer);
            put(outer, "read.md", "Excluded outside bytes.\n");
            put(f.root, "inside/read.md", "Counted inside return bytes.\n");
            fs.symlinkSync(
              path.join(f.root, "inside"),
              path.join(outer, "back"),
              "dir",
            );
            fs.symlinkSync(outer, path.join(dir, "via"), "dir");
            operand =
              kind === "outside-reentry"
                ? "via/back/read.md"
                : kind === "reentry-missing"
                  ? "via/back/missing.md"
                  : kind === "outside-missing"
                    ? "via/missing.md"
                    : "via/read.md";
          } else if (kind === "native-relative-long") operand = "../../" + long;
          else if (kind === "native-absolute-long")
            operand = path.join(os.tmpdir(), long);
          else if (kind === "inside") {
            put(f.root, "inside/read.md", "Counted ordinary inside bytes.\n");
            operand = path.relative(dir, path.join(f.root, "inside/read.md"));
          } else operand = "short-absent.md";
          const file = path.join(f.root, rel);
          fs.writeFileSync(
            file,
            fs
              .readFileSync(file, "utf8")
              .replace(
                "Mandatory always guidance survives exactly.",
                "Mandatory always guidance survives exactly.\n@" + operand,
              ),
          );
        }
        compileGuidance(f.ws);
        assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
        const before = snapshot(f.root),
          lines = [];
        assert.equal(
          await instructions(
            f.args.filter((x) => x !== "--write"),
            (line) => lines.push(line),
          ),
          0,
          lines.join("\n"),
        );
        assert.deepEqual(snapshot(f.root), before);
        const predicted = lines
          .join("\n")
          .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/);
        if (!join && kind !== "native-absolute-long")
          assert.ok(predicted, lines.join("\n"));
        assert.equal(
          await instructions(f.args, (line) => lines.push(line)),
          0,
          lines.join("\n"),
        );
        const { alwaysTier } = await import("./context.mjs");
        if (predicted)
          assert.equal(
            Number(predicted[1].replaceAll(",", "")),
            alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
            lines.join("\n"),
          );
        assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
        assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
      });

for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md"])
  for (const scoped of [false, true])
    for (const join of [false, true])
      for (const kind of [
        "relative",
        "absolute",
        "after-only",
        "after-absolute",
        "relative-chain",
        "outside-first",
        "inside-first",
      ])
        test(`native lexical re-entry preserves corpus membership (${rel}, scoped ${scoped}, join ${join}, ${kind})`, async () => {
          const f = await ready(join, rel);
          if (scoped) {
            const file = path.join(f.ws, "context/api.md");
            fs.writeFileSync(
              file,
              fs
                .readFileSync(file, "utf8")
                .replace('target: "api/CLAUDE.md"', 'paths: ["api/**"]'),
            );
            compileGuidance(f.ws);
          }
          const side = f.root + "-ordinary-alias",
            inside = path.join(f.root, "inside"),
            file = path.join(f.root, rel),
            dir = path.dirname(file);
          put(
            f.root,
            "inside/policy.md",
            "Count this project-owned content.\n",
          );
          fs.symlinkSync(inside, side, "dir");
          roots.push(side);
          if (kind === "relative-chain") {
            const second = f.root + "-second-alias";
            put(
              f.root,
              "second/child.md",
              "Count this chained project content too.\n",
            );
            fs.symlinkSync(path.join(f.root, "second"), second, "dir");
            roots.push(second);
            fs.appendFileSync(
              path.join(inside, "policy.md"),
              "\n@../" + path.basename(second) + "/child.md\n",
            );
          }
          if (kind === "outside-first" || kind === "inside-first") {
            const name = path.basename(f.root) + "-neighbor.md",
              outside = path.join(path.dirname(f.root), name);
            fs.writeFileSync(outside, "Excluded outside content.\n");
            roots.push(outside);
            put(
              f.root,
              name,
              "Inside decoy, counted only from the canonical first visit.\n",
            );
            fs.appendFileSync(
              path.join(inside, "policy.md"),
              "\n@../" + name + "\n",
            );
          }
          const at = kind.startsWith("after-")
            ? path.join(f.root, ".claude/rules/portulan/on-read.md")
            : file;
          const operand =
            kind === "absolute" || kind === "after-absolute"
              ? path.join(side, "policy.md")
              : path.relative(path.dirname(at), path.join(side, "policy.md"));
          if (kind.startsWith("after-")) {
            const source = path.join(f.ws, "context/history.md"),
              text = fs.readFileSync(source, "utf8");
            fs.writeFileSync(
              source,
              text.replace(
                /^description:.*$/m,
                'description: "History @' + operand + '"',
              ),
            );
          } else {
            const canonical = path.relative(
              dir,
              path.join(inside, "policy.md"),
            );
            let imports = "@" + operand;
            if (kind === "outside-first") imports += "\n@" + canonical;
            if (kind === "inside-first")
              imports = "@" + canonical + "\n" + imports;
            fs.writeFileSync(
              file,
              fs
                .readFileSync(file, "utf8")
                .replace(
                  "Mandatory always guidance survives exactly.",
                  "Mandatory always guidance survives exactly.\n" + imports,
                ),
            );
            assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
          }
          const before = snapshot(f.root),
            sideBefore = fs.readlinkSync(side),
            lines = [];
          assert.equal(
            await instructions(
              f.args.filter((x) => x !== "--write"),
              (line) => lines.push(line),
            ),
            0,
            lines.join("\n"),
          );
          assert.deepEqual(snapshot(f.root), before);
          assert.equal(fs.readlinkSync(side), sideBefore);
          const predicted = lines
              .join("\n")
              .match(/always tier goes from [\d,]+ B .* to ([\d,]+) B/),
            absolute = kind === "absolute" || kind === "after-absolute";
          if (!join && !absolute) assert.ok(predicted, lines.join("\n"));
          assert.equal(
            await instructions(f.args, (line) => lines.push(line)),
            0,
            lines.join("\n"),
          );
          const { alwaysTier } = await import("./context.mjs");
          if (predicted)
            assert.equal(
              Number(predicted[1].replaceAll(",", "")),
              alwaysTier(f.root).entries.reduce((n, e) => n + e.bytes, 0),
              lines.join("\n"),
            );
          assert.equal(compileGuidance(f.ws, { check: true }).drifted, 0);
          assert.equal(fs.readlinkSync(side), sideBefore);
          assert.equal(fs.existsSync(path.join(f.root, JOURNAL)), false);
        });
