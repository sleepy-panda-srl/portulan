// One CLI split/join, bounded to its original sources. The planner proves the saved operation again.
// Immutable lease children serialize recovery without deleting a possibly live writer's lock.
// Terminal proof outlives rollback authority; unproved initialization remains for human review.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  CompileError,
  atomicWrite,
  guardedRemove,
  sameContent,
  workspaceProtection,
} from "./guidance-files.mjs";
import { isInside } from "./inside.mjs";

export const SOURCE_JOURNAL = ".portulan-instructions-journal";
const ROOTS = ["CLAUDE.md", ".claude/CLAUDE.md"],
  active = new Set(),
  UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  HEX = /^[a-f0-9]{64}$/;
const encode = (value) => `${JSON.stringify(value, null, 2)}\n`,
  sha = (value) => createHash("sha256").update(value).digest("hex"),
  posix = (value) => value.split(path.sep).join("/");
const fail = (message) => {
  throw new CompileError(`instruction recovery: ${message}`);
};
const sameId = (a, b) =>
  Boolean(
    a &&
      b &&
      a.dev === b.dev &&
      a.ino === b.ino &&
      (b.mode === undefined || a.mode === b.mode),
  );
const id = (at) => ({ dev: at.dev, ino: at.ino, mode: at.mode });
const validId = (value) =>
  keys(value, "dev,ino,mode") &&
  Number.isSafeInteger(value.dev) &&
  value.dev >= 0 &&
  Number.isSafeInteger(value.ino) &&
  value.ino >= 0 &&
  Number.isSafeInteger(value.mode) &&
  value.mode >= 0 &&
  value.mode <= 0o177777;
const keys = (value, names) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === names.split(",").sort().join(",");
function entry(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}
function relative(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    !/[\\\u0000-\u001f\u007f]/.test(value) &&
    !path.posix.isAbsolute(value) &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
function inside(root, rel) {
  if (!relative(rel)) fail(`invalid saved path ${JSON.stringify(rel)}`);
  const full = path.resolve(root, ...rel.split("/"));
  if (!isInside(root, full)) fail("saved path escapes its project");
  let at = root;
  for (const part of rel.split("/").slice(0, -1)) {
    at = path.join(at, part);
    const s = entry(at);
    if (s && (!s.isDirectory() || s.isSymbolicLink()))
      fail(`${rel} has an aliased or non-directory parent`);
  }
  return full;
}
function readFile(file) {
  const at = entry(file);
  if (!at) return null;
  if (!at.isFile() || at.isSymbolicLink() || at.size > 20 * 1024 * 1024)
    fail(`${file} is not a bounded ordinary file`);
  const fd = fs.openSync(
    file,
    fs.constants.O_RDONLY |
      (fs.constants.O_NOFOLLOW ?? 0) |
      fs.constants.O_NONBLOCK,
  );
  try {
    const held = fs.fstatSync(fd);
    if (!held.isFile() || !sameId(held, id(at)) || held.size > 20 * 1024 * 1024)
      fail(`${file} changed while reading`);
    return {
      file,
      bytes: fs.readFileSync(fd),
      identity: id(held),
      links: held.nlink,
    };
  } finally {
    fs.closeSync(fd);
  }
}
function temporary(name, base, bytes) {
  for (const claim of [false, true]) {
    const prefix = `.${base}.portulan-guidance${claim ? "-claim" : ""}.`;
    if (!name.startsWith(prefix)) continue;
    const parts = name.slice(prefix.length).split(".");
    return (
      parts.length === (claim ? 3 : 2) &&
      /^\d+$/.test(parts[0]) &&
      UUID.test(parts[1]) &&
      (!claim || parts[2] === sha(bytes))
    );
  }
  return false;
}
function metadataBase(name) {
  const match =
    /^\.((?:owner|terminal|lease-[a-f0-9-]{36}|(?:stage|claim|undo-stage|undo-claim|retired)-\d+-[a-f0-9-]{36})\.json)\.portulan-guidance(?:-claim)?\.\d+\.[a-f0-9-]{36}(?:\.[a-f0-9]{64})?$/.exec(
      name,
    );
  return match ? match[1] : name;
}
function metadataName(name) {
  return /^(?:owner|terminal|lease-[a-f0-9-]{36}|(?:stage|claim|undo-stage|undo-claim|retired)-\d+-[a-f0-9-]{36})\.json$/.test(
    metadataBase(name),
  );
}
function metadataAliases(found) {
  const base = metadataBase(path.basename(found.file));
  return fs
    .readdirSync(path.dirname(found.file))
    .filter(
      (name) =>
        name !== path.basename(found.file) &&
        (name === base || temporary(name, base, found.bytes)),
    )
    .flatMap((name) => {
      const file = path.join(path.dirname(found.file), name);
      try {
        const other = readFile(file);
        return other &&
          sameId(other.identity, found.identity) &&
          sameContent(other.bytes, found.bytes)
          ? [other]
          : [];
      } catch {
        return [];
      }
    });
}
function canonical(file) {
  const found = readFile(file);
  if (!found) return null;
  if (
    (found.identity.mode & 0o777) !== 0o600 ||
    found.links !== metadataAliases(found).length + 1
  )
    fail(`${file} is not private metadata with proved aliases`);
  let value;
  try {
    value = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(found.bytes),
    );
  } catch {
    fail(`${file} is malformed metadata`);
  }
  if (!sameContent(found.bytes, encode(value)))
    fail(`${file} is not canonical metadata`);
  return { ...found, value };
}
function removeMetadata(found) {
  const base = metadataBase(path.basename(found.file));
  for (const alias of metadataAliases(found))
    if (entry(alias.file))
      guardedRemove(alias.file, {
        before: alias.bytes,
        identity: alias.identity,
        allowLinks: true,
        claimBase: base,
      });
  if (entry(found.file))
    guardedRemove(found.file, {
      before: found.bytes,
      identity: found.identity,
      claimBase: base,
    });
}
function binding(root, workspace) {
  return (
    posix(path.relative(fs.realpathSync(root), fs.realpathSync(workspace))) ||
    "."
  );
}
function namespace() {
  try {
    let boot;
    if (process.platform === "linux")
      boot =
        fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8") +
        fs.readlinkSync("/proc/self/ns/pid");
    else if (process.platform === "darwin")
      boot = execFileSync("/usr/sbin/sysctl", ["-n", "kern.bootsessionuuid"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    else return null;
    return sha(
      `${process.platform}\n${os.hostname()}\n${process.getuid()}\n${boot}`,
    );
  } catch {
    return null;
  }
}
function dead(lease) {
  if (lease.state === "released") return true;
  try {
    process.kill(lease.pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}
function terminalShape(value, root, workspace) {
  return (
    keys(value, "format,kind,state,owner,nonce,workspace,root,roots,paths") &&
    value.format === 1 &&
    value.kind === "terminal" &&
    ["committed", "aborted"].includes(value.state) &&
    UUID.test(value.nonce) &&
    HEX.test(value.owner) &&
    value.workspace === binding(root, workspace) &&
    validId(value.root) &&
    sameId(fs.statSync(root), value.root) &&
    Array.isArray(value.roots) &&
    value.roots.length > 0 &&
    value.roots.every((rel) => ROOTS.includes(rel)) &&
    Array.isArray(value.paths) &&
    value.paths.every(relative) &&
    value.roots.every((rel) => value.paths.includes(rel))
  );
}
export function sourceJournalPresent(root) {
  return Boolean(entry(path.join(root, SOURCE_JOURNAL)));
}
export function assertNoSourceJournal(root) {
  if (sourceJournalPresent(root))
    fail(
      `pending journal at ${path.join(root, SOURCE_JOURNAL)}; resume instructions --write before another writer runs`,
    );
}
export function assertJournalScope(root, workspace) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(workspace, "workspace.json"), "utf8"),
  );
  const reserved = SOURCE_JOURNAL.toLowerCase(),
    protectedPaths = workspaceProtection(
      root,
      posix(path.relative(root, workspace)) || ".",
      manifest,
    );
  const clash = protectedPaths.find((p) => {
    const rel = p.path.toLowerCase();
    return (
      rel === reserved ||
      rel.startsWith(reserved + "/") ||
      (p.directory && (rel === "." || reserved.startsWith(rel + "/")))
    );
  });
  if (clash)
    fail(
      `${SOURCE_JOURNAL} overlaps current slot or protected path ${clash.path}; preserve the directory and review that binding`,
    );
}

export class InstructionJournal {
  constructor(root, workspace, context) {
    this.root = path.resolve(root);
    this.workspace = workspace;
    this.context = context;
    this.dir = path.join(this.root, SOURCE_JOURNAL);
    this.records = [];
    this.known = new Map();
    this.lease = null;
  }
  checkRoot() {
    assertJournalScope(this.root, this.workspace);
    const at = entry(this.dir);
    if (
      !at?.isDirectory() ||
      at.isSymbolicLink() ||
      (at.mode & 0o777) !== 0o700 ||
      !sameId(at, this.dirId)
    )
      fail(`journal changed or is not private: ${this.dir}`);
    if (
      !sameId(fs.statSync(this.root), this.owner?.root ?? this.terminal?.root)
    )
      fail("journal belongs to another project identity");
  }
  remember(found) {
    this.known.set(path.basename(found.file), found);
    return found.value;
  }
  load() {
    const at = entry(this.dir);
    if (!at) return null;
    if (!at.isDirectory() || at.isSymbolicLink() || (at.mode & 0o777) !== 0o700)
      fail(
        `unproved or non-private journal directory ${this.dir}; review it before removal`,
      );
    this.dirId = id(at);
    const owner = canonical(path.join(this.dir, "owner.json"));
    let terminal = canonical(path.join(this.dir, "terminal.json"));
    if (!terminal)
      for (const name of fs.readdirSync(this.dir)) {
        if (!name.startsWith(".terminal.json.portulan-guidance-claim."))
          continue;
        const candidate = canonical(path.join(this.dir, name));
        if (
          candidate &&
          name.endsWith("." + sha(candidate.bytes)) &&
          terminalShape(candidate.value, this.root, this.workspace)
        ) {
          terminal = candidate;
          break;
        }
      }
    if (terminal) {
      if (!terminalShape(terminal.value, this.root, this.workspace))
        fail(`foreign terminal record at ${terminal.file}`);
      this.terminal = this.remember(terminal);
    }
    if (!owner) {
      if (!this.terminal)
        fail(
          `unproved initializer at ${this.dir}; no source recovery is authorized, review its files`,
        );
      this.owner = null;
      this.hash = this.terminal.owner;
      this.checkRoot();
      return this;
    }
    this.owner = this.remember(owner);
    this.hash = sha(owner.bytes);
    this.validateOwner();
    if (
      this.terminal &&
      (this.terminal.owner !== this.hash ||
        this.terminal.nonce !== this.owner.nonce)
    )
      fail("terminal record does not match its owner");
    for (const name of fs.readdirSync(this.dir)) {
      if (
        !/^(?:stage|claim|undo-stage|undo-claim|retired)-\d+-[a-f0-9-]{36}\.json$/.test(
          name,
        )
      )
        continue;
      const found = canonical(path.join(this.dir, name)),
        record = found.value;
      this.validateRecord(record);
      if (name !== `${record.phase}-${record.index}-${record.attempt}.json`)
        fail("source record filename disagrees with its action");
      this.remember(found);
      this.records.push(record);
    }
    if (!this.terminal) {
      this.chain();
      for (const record of this.records.filter(
        (record) => record.phase === "retired",
      ))
        this.assertRetirement(record);
      if (this.records.some((record) => !this.leaseNonces.has(record.lease)))
        fail("source record belongs to an unproved lease");
    }
    this.checkRoot();
    return this;
  }
  validateOwner() {
    const o = this.owner;
    if (
      !keys(
        o,
        "format,kind,nonce,pid,namespace,root,workspace,context,operation,taken,reads,inputs",
      ) ||
      o.format !== 1 ||
      o.kind !== "instructions" ||
      !UUID.test(o.nonce) ||
      !Number.isSafeInteger(o.pid) ||
      o.pid < 1 ||
      !HEX.test(o.namespace) ||
      o.workspace !== binding(this.root, this.workspace) ||
      o.context !== this.context ||
      !["split", "join"].includes(o.operation) ||
      !validId(o.root) ||
      !sameId(fs.statSync(this.root), o.root) ||
      !Array.isArray(o.inputs) ||
      o.inputs.length === 0 ||
      o.inputs.length > 10000 ||
      !o.inputs.some((input) => ROOTS.includes(input.file)) ||
      !Array.isArray(o.reads) ||
      !Array.isArray(o.taken) ||
      new Set(o.taken).size !== o.taken.length ||
      o.taken.some(
        (name) =>
          typeof name !== "string" || !name || /[\\/\u0000-\u001f]/.test(name),
      )
    )
      fail(`foreign or malformed owner at ${this.dir}`);
    const seen = new Set();
    for (const input of o.inputs) {
      const root = ROOTS.includes(input.file),
        unit =
          typeof this.context === "string" &&
          input.file.startsWith(this.context) &&
          !input.file.slice(this.context.length).includes("/") &&
          input.file.endsWith(".md");
      inside(this.root, input.file);
      if (
        !keys(input, "file,before,next,mode,original") ||
        input.file === SOURCE_JOURNAL ||
        input.file.startsWith(SOURCE_JOURNAL + "/") ||
        seen.has(input.file) ||
        (!root && !unit) ||
        !Number.isSafeInteger(input.mode) ||
        input.mode < 0 ||
        input.mode > 0o177777 ||
        (input.before !== null && typeof input.before !== "string") ||
        (input.next !== null && typeof input.next !== "string") ||
        (root && (input.before === null || input.next === null)) ||
        (!root &&
          (o.operation === "split"
            ? input.before !== null || input.next === null
            : input.before === null || input.next !== null)) ||
        (input.before !== null
          ? !validId(input.original)
          : input.original !== null)
      )
        fail("invalid source edit in saved operation");
      seen.add(input.file);
    }
    const readNames = new Set();
    for (const row of o.reads) {
      if (
        !keys(row, "file,text,identity") ||
        !relative(row.file) ||
        (!ROOTS.includes(row.file) && !seen.has(row.file)) ||
        readNames.has(row.file) ||
        (row.text !== null
          ? typeof row.text !== "string" || !validId(row.identity)
          : row.identity !== null)
      )
        fail("invalid planning read set");
      readNames.add(row.file);
    }
    if (!ROOTS.every((root) => readNames.has(root)))
      fail("planning read set must retain both root observations");
  }
  validateRecord(r) {
    const input = this.owner.inputs[r?.index];
    if (
      !keys(r, "format,kind,owner,nonce,lease,index,phase,attempt,pid,data") ||
      r.format !== 1 ||
      r.kind !== "source" ||
      r.owner !== this.hash ||
      r.nonce !== this.owner.nonce ||
      !UUID.test(r.attempt) ||
      !UUID.test(r.lease) ||
      !Number.isSafeInteger(r.pid) ||
      r.pid < 1 ||
      !Number.isSafeInteger(r.index) ||
      !["stage", "claim", "undo-stage", "undo-claim", "retired"].includes(
        r.phase,
      ) ||
      !input ||
      r.data?.file !== input.file
    )
      fail("malformed source publication record");
    const d = r.data,
      base = path.posix.basename(input.file),
      parent = path.posix.dirname(input.file);
    inside(this.root, d.path);
    if (
      !keys(
        d,
        r.phase.endsWith("stage") || r.phase === "retired"
          ? "file,path,identity"
          : "file,path,identity,placeholder,from",
      ) ||
      path.posix.dirname(d.path) !== parent ||
      !validId(d.identity)
    )
      fail("source publication path or identity is invalid");
    const name = path.posix.basename(d.path),
      undo = r.phase.startsWith("undo-"),
      body = r.phase.endsWith("stage")
        ? undo
          ? input.before
          : input.next
        : undo
          ? input.next
          : r.phase === "retired" && this.owner.operation === "split"
            ? input.next
            : input.before;
    if (body === null) fail("source publication records an impossible action");
    if (r.phase.endsWith("stage")) {
      if (
        !(
          name.startsWith(base + `.portulan-upgrade.${r.pid}.`) &&
          /^\d+$/.test(
            name.slice((base + `.portulan-upgrade.${r.pid}.`).length),
          )
        ) &&
        !(
          name.startsWith(`.${base}.portulan-guidance.${r.pid}.`) &&
          UUID.test(name.slice(`.${base}.portulan-guidance.${r.pid}.`.length))
        )
      )
        fail("source staging name is not owned by this attempt");
    } else if (
      !name.startsWith(`.${base}.portulan-guidance-claim.${r.pid}.`) ||
      !temporary(name, base, body) ||
      (r.phase !== "retired" && !validId(d.placeholder))
    )
      fail("source claim name or placeholder is invalid");
    if (r.phase === "retired" && ROOTS.includes(input.file))
      fail("retirement confirmation is not a direct unit");
    if (r.phase.endsWith("claim")) {
      inside(this.root, d.from);
      if (
        path.posix.dirname(d.from) !== parent ||
        !(
          d.from === input.file ||
          temporary(path.posix.basename(d.from), base, body) ||
          path.posix.basename(d.from).startsWith(base + ".portulan-upgrade.")
        )
      )
        fail("source claim does not name its actual acquired entry");
    }
  }
  write(name, value) {
    this.checkRoot();
    const file = path.join(this.dir, name),
      bytes = Buffer.from(encode(value));
    let published;
    try {
      atomicWrite(file, bytes, {
        exclusive: true,
        mode: 0o600,
        onPublish: (identity) => {
          published = identity;
        },
      });
    } catch (error) {
      const found = published ? canonical(file) : null;
      if (
        !found ||
        !sameId(found.identity, published) ||
        !sameContent(found.bytes, bytes)
      )
        throw error;
    }
    const found = canonical(file);
    if (
      !found ||
      !sameContent(found.bytes, bytes) ||
      !sameId(found.identity, published)
    )
      fail(`record publication could not be authenticated: ${file}`);
    this.remember(found);
    return found.value;
  }
  static create(root, workspace, context, operation, edits, reads, taken) {
    const j = new InstructionJournal(root, workspace, context),
      ns = namespace();
    if (!ns)
      fail("the local boot/PID namespace is unavailable; no source was moved");
    const rootId = id(fs.statSync(root));
    j.owner = {
      format: 1,
      kind: "instructions",
      nonce: randomUUID(),
      pid: process.pid,
      namespace: ns,
      root: rootId,
      workspace: binding(root, workspace),
      context,
      operation,
      taken: [...taken],
      reads: [...reads]
        .filter(
          ([file]) =>
            ROOTS.includes(file) || edits.some((edit) => edit.file === file),
        )
        .map(([file, s]) => ({ file, ...s })),
      inputs: edits.map((e) => ({
        file: e.file,
        before: e.before,
        next: e.next,
        mode: e.mode ?? reads.get(e.file)?.identity?.mode ?? 0o100644,
        original: e.before === null ? null : reads.get(e.file)?.identity,
      })),
    };
    j.validateOwner();
    if (Buffer.byteLength(encode(j.owner)) > 20 * 1024 * 1024)
      fail("source operation exceeds its bounded journal");
    fs.mkdirSync(j.dir, { mode: 0o700 });
    fs.chmodSync(j.dir, 0o700);
    j.dirId = id(fs.statSync(j.dir));
    j.hash = sha(encode(j.owner));
    j.write("owner.json", j.owner);
    j.lease = { nonce: j.owner.nonce, pid: process.pid, state: "held" };
    active.add(j.lease.nonce);
    return j;
  }
  chain() {
    let lease = { nonce: this.owner.nonce, pid: this.owner.pid, state: "held" },
      count = 0;
    this.leaseNonces = new Set([lease.nonce]);
    for (;;) {
      if (++count > 10000) fail("lease chain exceeds its bound");
      const found = canonical(path.join(this.dir, `lease-${lease.nonce}.json`));
      if (!found) return lease;
      const next = found.value;
      if (
        !keys(next, "format,kind,owner,parent,nonce,pid,state") ||
        next.format !== 1 ||
        next.kind !== "lease" ||
        next.owner !== this.hash ||
        next.parent !== lease.nonce ||
        !UUID.test(next.nonce) ||
        this.leaseNonces.has(next.nonce) ||
        !["held", "released"].includes(next.state) ||
        (next.state === "held"
          ? !Number.isSafeInteger(next.pid) || next.pid < 1
          : next.pid !== null)
      )
        fail("malformed lease chain");
      this.remember(found);
      this.leaseNonces.add(next.nonce);
      lease = next;
    }
  }
  acquire() {
    this.checkRoot();
    if (this.terminal) return;
    if (namespace() !== this.owner.namespace)
      fail("journal belongs to another or unverified boot/PID namespace");
    const leaf = this.chain();
    if (!dead(leaf)) fail(`another instruction writer owns ${this.dir}`);
    const next = {
      format: 1,
      kind: "lease",
      owner: this.hash,
      parent: leaf.nonce,
      nonce: randomUUID(),
      pid: process.pid,
      state: "held",
    };
    try {
      this.write(`lease-${leaf.nonce}.json`, next);
    } catch (error) {
      fail(`recovery lease was not acquired: ${error.message}`);
    }
    this.lease = next;
    active.add(next.nonce);
    this.guard();
  }
  guard() {
    this.checkRoot();
    const owner = canonical(path.join(this.dir, "owner.json"));
    if (!owner || sha(owner.bytes) !== this.hash) fail("journal owner changed");
    if (entry(path.join(this.dir, "terminal.json")))
      fail("source transaction is already terminal");
    const leaf = this.chain();
    if (
      !this.lease ||
      leaf.nonce !== this.lease.nonce ||
      leaf.pid !== process.pid ||
      !active.has(leaf.nonce)
    )
      fail("instruction recovery lease changed");
  }
  release() {
    if (!this.lease) return;
    try {
      if (entry(this.dir) && !this.terminal) {
        this.guard();
        this.write(`lease-${this.lease.nonce}.json`, {
          format: 1,
          kind: "lease",
          owner: this.hash,
          parent: this.lease.nonce,
          nonce: randomUUID(),
          pid: null,
          state: "released",
        });
      }
    } finally {
      active.delete(this.lease.nonce);
    }
  }
  observe(edit, phase, packet) {
    this.guard();
    const index = this.owner.inputs.findIndex(
      (input) => input.file === edit.file,
    );
    if (index < 0) fail("an unplanned source edit reached the journal");
    const data = {
      file: edit.file,
      path: posix(
        path.relative(this.root, packet.staging ?? packet.claim ?? packet.file),
      ),
      identity: { ...packet.identity },
    };
    if (phase.endsWith("claim")) {
      data.placeholder = { ...packet.placeholder };
      data.from = posix(path.relative(this.root, packet.file));
    }
    const record = {
      format: 1,
      kind: "source",
      owner: this.hash,
      nonce: this.owner.nonce,
      lease: this.lease.nonce,
      index,
      phase,
      attempt: randomUUID(),
      pid: process.pid,
      data,
    };
    this.validateRecord(record);
    if (phase === "retired") this.assertRetirement(record);
    const body = this.body(record),
      found = readFile(inside(this.root, data.path));
    const expected = phase.endsWith("claim") ? data.placeholder : data.identity;
    if (
      !found ||
      !sameId(found.identity, expected) ||
      !sameContent(found.bytes, body)
    )
      fail("prepared source changed before its durable record");
    this.write(`${phase}-${index}-${record.attempt}.json`, record);
    this.records.push(record);
    this.guard();
  }
  body(record) {
    const input = this.owner.inputs[record.index],
      undo = record.phase.startsWith("undo-");
    return record.phase.endsWith("stage")
      ? undo
        ? input.before
        : input.next
      : undo
        ? input.next
        : record.phase === "retired" && this.owner.operation === "split"
          ? input.next
          : input.before;
  }
  source(input) {
    return readFile(inside(this.root, input.file));
  }
  ownStage(input, current, undo = false) {
    return Boolean(
      current &&
        this.records.some(
          (r) =>
            r.data.file === input.file &&
            r.phase === (undo ? "undo-stage" : "stage") &&
            sameId(current.identity, r.data.identity) &&
            sameContent(current.bytes, undo ? input.before : input.next),
        ),
    );
  }
  before(input, current) {
    return input.before === null
      ? current === null
      : Boolean(
          current &&
            sameContent(current.bytes, input.before) &&
            (sameId(current.identity, input.original) ||
              this.ownStage(input, current, true)),
        );
  }
  after(input, current) {
    return input.next === null
      ? current === null
      : this.ownStage(input, current, false);
  }
  recoverClaims() {
    this.assertArtifacts();
    for (const r of this.records.filter((r) => r.phase.endsWith("claim"))) {
      this.guard();
      const input = this.owner.inputs[r.index],
        claim = readFile(inside(this.root, r.data.path));
      if (!claim || sameId(claim.identity, r.data.placeholder)) continue;
      const source = this.source(input);
      if (source) {
        if (!sameId(source.identity, claim.identity)) continue;
      } else {
        if (r.data.from !== input.file) continue;
        try {
          fs.linkSync(claim.file, inside(this.root, input.file));
        } catch (error) {
          const now = this.source(input);
          if (!now || !sameId(now.identity, claim.identity))
            fail(`source arrival conflicts with retained ${claim.file}`);
        }
      }
      const now = this.source(input);
      if (now && sameId(now.identity, claim.identity)) {
        this.guard();
        if (!sameContent(claim.bytes, this.body(r)))
          fail(
            `changed held original was returned; preserved ${claim.file} and ${input.file}`,
          );
        guardedRemove(claim.file, {
          before: claim.bytes,
          identity: claim.identity,
          allowLinks: true,
          claimBase: path.basename(input.file),
          onClaim: (packet) =>
            this.observe({ file: input.file }, r.phase, packet),
        });
      }
    }
  }
  assertRetirement(record) {
    // A preparation alias cannot prove that the public source was acquired.
    const phase = this.owner.operation === "join" ? "claim" : "undo-claim";
    if (
      !this.records.some(
        (intent) =>
          intent.phase === phase &&
          intent.index === record.index &&
          intent.lease === record.lease &&
          intent.pid === record.pid &&
          intent.data.from === record.data.file &&
          intent.data.path === record.data.path &&
          sameId(intent.data.identity, record.data.identity),
      )
    )
      fail(
        `retirement confirmation for ${record.data.file} has no matching acquired-source intent; review ${this.dir}`,
      );
  }
  restoreRetiredUnits(references) {
    for (const record of this.records.filter(
      (record) => record.phase === "retired",
    )) {
      const input = this.owner.inputs[record.index];
      if (!references.has(input.file.normalize("NFC").toLowerCase())) continue;
      this.guard();
      if (this.source(input) !== null) continue;
      const undo = this.owner.operation === "join",
        body = undo ? input.before : input.next;
      atomicWrite(inside(this.root, input.file), body, {
        exclusive: true,
        mode: input.mode,
        onPrepare: (packet) =>
          this.observe(
            { file: input.file },
            undo ? "undo-stage" : "stage",
            packet,
          ),
        onCleanupClaim: (packet) =>
          this.observe(
            { file: input.file },
            undo ? "claim" : "undo-claim",
            packet,
          ),
      });
    }
  }
  aliases(input, current) {
    if (!current) return [];
    return this.records
      .filter((r) => r.data.file === input.file)
      .flatMap((r) => {
        const file = inside(this.root, r.data.path);
        try {
          const found = readFile(file);
          return found &&
            sameId(found.identity, current.identity) &&
            sameContent(found.bytes, current.bytes)
            ? [found]
            : [];
        } catch {
          return [];
        }
      });
  }
  remaining() {
    this.assertUneditedRoots();
    this.assertArtifacts();
    const out = [];
    for (const input of this.owner.inputs) {
      const current = this.source(input);
      if (this.after(input, current)) continue;
      if (!this.before(input, current))
        fail(
          `source changed or arrived independently: ${input.file}; preserved with ${this.dir}`,
        );
      if (current) {
        const aliases = this.aliases(input, current);
        if (current.links !== aliases.length + 1)
          fail(`${input.file} has an unproved alias`);
        for (const alias of aliases) {
          this.guard();
          guardedRemove(alias.file, {
            before: alias.bytes,
            identity: alias.identity,
            allowLinks: true,
            claimBase: path.basename(input.file),
            onClaim: (packet) =>
              this.observe({ file: input.file }, "claim", packet),
          });
        }
      }
      out.push({
        root: "tree",
        file: input.file,
        before: input.before,
        next: input.next,
        mode: input.mode,
        beforeIdentity: current?.identity ?? null,
      });
    }
    return out;
  }
  originalsRestored() {
    return (
      this.changedUneditedRoot() === null &&
      this.owner.inputs.every((input) => this.before(input, this.source(input)))
    );
  }
  complete() {
    return (
      this.changedUneditedRoot() === null &&
      this.owner.inputs.every((input) => this.after(input, this.source(input)))
    );
  }
  cleanupSources() {
    this.assertUneditedRoots();
    this.assertArtifacts();
    for (const r of [...this.records]) {
      this.guard();
      const found = readFile(inside(this.root, r.data.path));
      if (!found) continue;
      const identity =
        r.phase.endsWith("claim") && sameId(found.identity, r.data.placeholder)
          ? r.data.placeholder
          : r.data.identity;
      if (
        !sameId(found.identity, identity) ||
        !sameContent(found.bytes, this.body(r))
      )
        fail(`changed source artifact retained at ${found.file}`);
      const phase =
        r.phase === "stage" ||
        r.phase === "undo-claim" ||
        (r.phase === "retired" && this.owner.operation === "split")
          ? "undo-claim"
          : "claim";
      guardedRemove(found.file, {
        before: found.bytes,
        identity: found.identity,
        allowLinks: true,
        claimBase: path.basename(r.data.file),
        onClaim: (packet) => this.observe({ file: r.data.file }, phase, packet),
      });
    }
    this.assertArtifacts();
  }
  assertArtifacts() {
    const known = new Set(this.records.map((r) => r.data.path));
    for (const input of this.owner.inputs) {
      const file = inside(this.root, input.file),
        parent = path.dirname(file),
        base = path.basename(file);
      if (!entry(parent)) continue;
      for (const name of fs.readdirSync(parent)) {
        if (
          !name.startsWith(`.${base}.portulan-guidance.`) &&
          !name.startsWith(`.${base}.portulan-guidance-claim.`) &&
          !name.startsWith(`${base}.portulan-upgrade.`)
        )
          continue;
        const full = path.join(parent, name),
          rel = posix(path.relative(this.root, full));
        if (!known.has(rel))
          fail(
            `unproved alias or source preparation at ${full}; retained ${this.dir}; review the exact artifact before resuming`,
          );
      }
    }
  }
  changedUneditedRoot() {
    for (const row of this.owner.reads.filter(
      (row) =>
        ROOTS.includes(row.file) &&
        !this.owner.inputs.some((input) => input.file === row.file),
    )) {
      try {
        const current = readFile(inside(this.root, row.file));
        if (
          row.text === null
            ? current !== null
            : !current ||
              current.links !== 1 ||
              !sameId(current.identity, row.identity) ||
              !sameContent(current.bytes, row.text)
        )
          return row.file;
      } catch {
        return row.file;
      }
    }
    return null;
  }
  assertUneditedRoots() {
    const changed = this.changedUneditedRoot();
    if (changed !== null)
      fail(
        `the other observed instruction root changed: ${changed}; preserve its references and retained ${this.dir}`,
      );
  }
  assertRootImages(retiring = false) {
    this.assertUneditedRoots();
    for (const input of this.owner.inputs.filter((input) =>
      ROOTS.includes(input.file),
    )) {
      const current = this.source(input);
      if (
        !(
          this.after(input, current) ||
          (!retiring && this.before(input, current))
        )
      )
        fail(
          `published instruction root changed: ${input.file}; preserve its referenced units and retained ${this.dir}`,
        );
    }
  }
  mark(state) {
    this.guard();
    if (state === "committed" ? !this.complete() : !this.originalsRestored())
      fail("whole source operation has not reached its terminal state");
    const terminal = {
      format: 1,
      kind: "terminal",
      state,
      owner: this.hash,
      nonce: this.owner.nonce,
      workspace: this.owner.workspace,
      root: this.owner.root,
      roots: this.owner.inputs
        .filter((i) => ROOTS.includes(i.file))
        .map((i) => i.file),
      paths: this.owner.inputs
        .filter((i) => (state === "committed" ? i.next : i.before) !== null)
        .map((i) => i.file),
    };
    this.write("terminal.json", terminal);
    this.terminal = terminal;
  }
  clean() {
    this.checkRoot();
    if (this.owner) this.assertArtifacts();
    if (!this.terminal) fail("source transaction has no terminal proof");
    for (const rel of this.terminal.paths)
      if (!readFile(inside(this.root, rel)))
        fail(`terminal source is missing: ${rel}; retained ${this.dir}`);
    if (this.owner)
      for (const r of this.records) {
        const found = readFile(inside(this.root, r.data.path));
        if (!found) continue;
        const identity = r.phase.endsWith("claim")
          ? sameId(found.identity, r.data.placeholder)
            ? r.data.placeholder
            : r.data.identity
          : r.data.identity;
        if (
          !sameId(found.identity, identity) ||
          !sameContent(found.bytes, this.body(r))
        )
          fail(`changed source artifact retained at ${found.file}`);
        guardedRemove(found.file, {
          before: found.bytes,
          identity: found.identity,
          allowLinks: true,
          claimBase: path.basename(r.data.file),
        });
      }
    for (const name of fs.readdirSync(this.dir)) {
      if (
        metadataBase(name) === "owner.json" ||
        metadataBase(name) === "terminal.json"
      )
        continue;
      this.checkRoot();
      if (!metadataName(name))
        fail(`unknown metadata retained at ${path.join(this.dir, name)}`);
      let found = canonical(path.join(this.dir, name));
      if (!found) continue;
      const v = found.value;
      if (v.kind === "source") {
        if (!this.owner) fail(`unproved metadata retained at ${found.file}`);
        this.validateRecord(v);
      } else if (v.kind !== "lease" || v.owner !== this.hash)
        fail(`unknown metadata retained at ${found.file}`);
      removeMetadata(found);
    }
    this.checkRoot();
    const owner = canonical(path.join(this.dir, "owner.json"));
    if (owner) {
      if (sha(owner.bytes) !== this.hash) fail("owner changed during cleanup");
      removeMetadata(owner);
    } else
      for (const name of fs.readdirSync(this.dir)) {
        if (metadataBase(name) !== "owner.json") continue;
        const found = canonical(path.join(this.dir, name));
        if (!found) continue;
        if (sha(found.bytes) !== this.hash)
          fail("retained owner changed during cleanup");
        removeMetadata(found);
      }
    this.checkRoot();
    for (const name of fs.readdirSync(this.dir)) {
      const found = canonical(path.join(this.dir, name));
      if (!found) continue;
      if (
        !terminalShape(found.value, this.root, this.workspace) ||
        found.value.owner !== this.hash
      )
        fail(
          `unproved final metadata retained at ${path.join(this.dir, name)}`,
        );
      removeMetadata(found);
    }
    this.checkRoot();
    fs.rmdirSync(this.dir);
    if (this.lease) active.delete(this.lease.nonce);
    this.lease = null;
  }
}

export function loadInstructionJournal(root, workspace, context) {
  return new InstructionJournal(root, workspace, context).load();
}
export function assertSourceJournalReady(root, workspace) {
  if (!sourceJournalPresent(root)) return;
  const directory = path.resolve(root, workspace),
    manifest = JSON.parse(
      fs.readFileSync(path.join(directory, "workspace.json"), "utf8"),
    ),
    rel =
      typeof manifest.slots?.context === "string"
        ? posix(
            path.relative(
              path.resolve(root),
              path.resolve(directory, manifest.slots.context),
            ),
          )
        : null,
    context = rel === null ? null : rel ? rel + "/" : "";
  const j = loadInstructionJournal(root, directory, context);
  if (j.terminal) {
    for (const root of j.terminal.paths)
      if (!readFile(inside(j.root, root)))
        fail(`missing source ${root}; resume instructions --write`);
    return;
  }
  if (!j.complete())
    fail(
      `source migration is interrupted at ${j.dir}; resume instructions --write`,
    );
}
