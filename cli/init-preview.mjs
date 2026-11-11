// Project guidance preview, shared by init and instruction migration.
import fs from "node:fs";
import { isAbsentImportError } from "./import-files.mjs";
import os from "node:os";
import path from "node:path";
import { preflightNestedEdits, readOwnedText } from "./guidance-files.mjs";
import { isInside } from "./inside.mjs";
import { alwaysTier } from "./context.mjs";
import {
    compileGuidance,
    guidanceUnits,
    planGuidance,
    GENERATED_DIRS,
    NESTED_REGISTRY,
    readNestedState,
    parseUnit,
    expandedBody,
    importSpans,
    importPath,
    importTargetIsFile,
    IMPORT_DEPTH,
    LEADS_LINE,
    GATES_LINE,
} from "./compile.mjs";

export function outsideTempParents(target) {
    const owner = fs.realpathSync(target),
        found = [];
    for (const base of [os.tmpdir(), path.dirname(owner)]) {
        try {
            const real = fs.realpathSync(base);
            if (!isInside(owner, real) && fs.statSync(real).isDirectory() && !found.includes(real)) found.push(real);
        } catch {}
    }
    return found;
}

export function previewAlways(
    target,
    files,
    { workspaceRel = ".portulan", hosts = ["claude-code", "agents-md"], checkWrites = true, migration = false } = {},
) {
    const root = path.resolve(target),
        owner = fs.realpathSync(root);
    const manifestRel = path.join(workspaceRel, "workspace.json");
    const manifest = JSON.parse(
        files.get(manifestRel)?.contents ?? fs.readFileSync(path.join(root, manifestRel), "utf8"),
    );
    const contextRel = path.join(workspaceRel, manifest.slots.context);
    const removed = new Set([...files].filter(([, value]) => value.contents === null).map(([rel]) => rel));
    for (const rel of [...removed]) {
        try {
            const real = fs.realpathSync(path.join(root, rel));
            if (isInside(owner, real)) removed.add(path.relative(owner, real));
        } catch {}
    }
    let unmeasured = false;
    const before = hosts.map((host) => {
        try {
            return alwaysTier(root, { host });
        } catch (error) {
            throw new Error(
                `${host === "agents-md" ? "AGENTS.md" : "Claude Code"} could not be measured: ${error.message}`,
            );
        }
    });
    for (const rel of [".claude", ".claude/rules", ".claude/rules/portulan", ".claude/skills"]) {
        let stat;
        try {
            stat = fs.lstatSync(path.join(root, rel));
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
            throw error;
        }
        if (!stat.isDirectory()) throw new Error(`${rel} is not an ordinary compiler output directory`);
    }
    let box, view;
    const candidates = outsideTempParents(target).sort(
        (left, right) =>
            Number(fs.statSync(right).dev === fs.statSync(owner).dev) -
            Number(fs.statSync(left).dev === fs.statSync(owner).dev),
    );
    for (const base of candidates) {
        try {
            box = fs.mkdtempSync(path.join(base, ".portulan-init-preview-"));
            view = path.join(box, path.basename(root));
            fs.mkdirSync(view);
            break;
        } catch {}
    }
    if (!view) throw new Error("no writable scratch location outside the target");
    const sourceLink = (file) => path.resolve(fs.realpathSync(path.dirname(file)), fs.readlinkSync(file));
    const prospective = (file, seen = new Set()) => {
        if (seen.has(file)) throw new Error("an import alias cannot be resolved");
        seen.add(file);
        let at = file,
            suffix = [];
        for (;;) {
            let value;
            try {
                value = fs.lstatSync(at);
            } catch (error) {
                if (!isAbsentImportError(error)) throw error;
            }
            if (value?.isSymbolicLink()) return prospective(path.resolve(sourceLink(at), ...suffix), seen);
            if (value) return path.resolve(fs.realpathSync(at), ...suffix);
            const parent = path.dirname(at);
            if (parent === at) throw new Error("an import cannot be resolved");
            suffix.unshift(path.basename(at));
            at = parent;
        }
    };
    const writable = (rel, unlink = false) => {
        if (!checkWrites) return;
        const file = path.join(root, rel);
        let value;
        try {
            value = fs.lstatSync(file);
        } catch (error) {
            if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
        }
        if (value && !unlink) {
            if (!value.isFile() || value.nlink > 1)
                throw new Error(`${rel} is not an ordinary singly linked write target`);
            fs.accessSync(file, fs.constants.W_OK);
        } else {
            let dir = path.dirname(file);
            while (!fs.existsSync(dir)) dir = path.dirname(dir);
            fs.accessSync(dir, fs.constants.W_OK | fs.constants.X_OK);
        }
    };
    const remains = (file) => {
        const real = prospective(file);
        return !(isInside(owner, real) && removed.has(path.relative(owner, real))) && importTargetIsFile(file);
    };
    const materialized = new Set(),
        originalEntries = new Map();
    const originalEntry = (file) => {
        const parent = fs.statSync(path.dirname(file), { bigint: true }),
            entry = fs.lstatSync(file, { bigint: true });
        let name = "";
        if (entry.nlink > 1n) {
            name = path.basename(file);
            try {
                const names = fs.readdirSync(path.dirname(file));
                if (!names.includes(name)) {
                    const folded = name.normalize("NFC").toLowerCase();
                    const actual = names.find((candidate) => {
                        if (candidate.normalize("NFC").toLowerCase() !== folded) return false;
                        const at = fs.lstatSync(path.join(path.dirname(file), candidate), { bigint: true });
                        return at.dev === entry.dev && at.ino === entry.ino;
                    });
                    if (actual !== undefined) name = actual;
                }
            } catch (error) {
                if (error.code !== "EACCES" && error.code !== "EPERM") throw error;
            }
        }
        return `${parent.dev}:${parent.ino}:${entry.dev}:${entry.ino}:${name}`;
    };

    const relative = (file) => {
        if (isInside(root, file)) return path.relative(root, file);
        if (isInside(owner, file)) return path.relative(owner, file);
        throw new Error("a required input lies outside the project");
    };
    const stat = (file) => {
        try {
            return fs.lstatSync(file);
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
            throw error;
        }
    };
    for (const [rel, file] of files)
        if (file.contents === null && stat(path.join(root, rel)))
            originalEntries.set(originalEntry(path.join(root, rel)), rel);
    const directory = (file) => {
        try {
            return fs.statSync(file).isDirectory();
        } catch (error) {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
            throw error;
        }
    };
    const link = (destination, next, kind) => {
        const parent = fs.realpathSync(path.dirname(destination)),
            target = path.resolve(next),
            existing = stat(destination);
        if (existing) {
            if (!existing.isSymbolicLink() || path.resolve(parent, fs.readlinkSync(destination)) !== target)
                throw new Error("conflicting projected link");
            return;
        }
        fs.symlinkSync(path.relative(parent, target) || ".", destination, kind);
    };
    const parents = (rel, optional = false) => {
        const parts = rel.split(path.sep);
        for (let count = 1; count < parts.length; count++) {
            const current = path.join(root, ...parts.slice(0, count)),
                value = stat(current);
            if (!value) break;
            if (migration && value.isSymbolicLink()) {
                const real = prospective(current);
                if (!isInside(owner, real)) {
                    if (!optional) throw new Error(`${rel} has an outside parent alias`);
                    if (!isInside(owner, prospective(path.resolve(root, rel)))) return false;
                    fs.mkdirSync(path.join(view, path.relative(root, current)), { recursive: true });
                    continue;
                }
                const destination = path.join(view, path.relative(root, current)),
                    next = path.join(view, path.relative(owner, real));
                if (!directory(real) && !directory(next)) {
                    if (optional) return false;
                    throw new Error(`${rel} has a missing or non-directory aliased parent`);
                }
                fs.mkdirSync(next, { recursive: true });
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                link(destination, next, "dir");
                continue;
            }
            if (!value.isDirectory()) {
                if (optional) return false;
                throw new Error(`${path.relative(root, current)} has an unmodeled ancestor type or alias`);
            }
        }
        return true;
    };
    const put = (rel, contents) => {
        const file = path.join(view, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, contents);
        materialized.add(rel);
    };
    const copy = (rel, required = false) => {
        if (materialized.has(rel)) return Boolean(stat(path.join(view, rel)));
        if (removed.has(rel)) return false;
        const file = path.resolve(root, rel);
        if (!isInside(root, file)) throw new Error("a required input leaves the project");
        if (!parents(rel, migration && !required)) return false;
        const value = stat(file);
        if (!value) return false;
        const identity = originalEntry(file),
            observed = originalEntries.get(identity);
        if (observed !== undefined) return Boolean(stat(path.join(view, observed)));
        const resolved = prospective(file);
        const canonical = isInside(owner, resolved) ? path.relative(owner, resolved) : null;
        if (!value.isSymbolicLink() && canonical !== null && removed.has(canonical)) return false;
        const destination = path.join(view, rel);
        if (!value.isSymbolicLink() && canonical !== null && materialized.has(canonical))
            return Boolean(stat(destination));
        if (value.isSymbolicLink()) {
            let real;
            try {
                real = fs.realpathSync(file);
            } catch (error) {
                if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
            }
            let next;
            if (real) {
                if (!isInside(owner, real)) {
                    if (required) throw new Error(`${rel} resolves outside its owner`);
                    return false;
                }
                if (fs.statSync(real).isDirectory()) {
                    if (migration && !required) return false;
                    throw new Error(`${rel} has an unmodeled directory alias`);
                }
                next = path.relative(owner, real);
            } else {
                const spelled = sourceLink(file);
                next = relative(spelled);
                if (!parents(next, migration && !required)) return false;
            }
            copy(next, required);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            link(destination, path.join(view, next), "file");
            materialized.add(rel);
            originalEntries.set(identity, rel);
            return true;
        }
        const real = fs.realpathSync(file);
        if (!isInside(owner, real)) throw new Error(`${rel} resolves outside its owner`);
        if (value.isDirectory()) fs.mkdirSync(destination, { recursive: true });
        else if (value.isFile()) put(rel, fs.readFileSync(real));
        else {
            if (required) throw new Error(`${rel} is not a regular input`);
            return false;
        }
        materialized.add(rel);
        originalEntries.set(identity, rel);
        return true;
    };
    const tree = (rel, select, recursive) => {
        const value = stat(path.join(root, rel));
        if (!value || !(value.isDirectory() || value.isSymbolicLink())) return;
        if (!copy(rel)) return;
        const dir = path.join(root, rel);
        if (!fs.statSync(dir).isDirectory()) return;
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const child = path.join(rel, item.name);
            if (item.isDirectory() && recursive) tree(child, select, true);
            else if (select(item.name))
                copy(child, child.startsWith(`.claude${path.sep}rules${path.sep}portulan${path.sep}`));
        }
    };
    const absolute = (bare) => {
        const real = prospective(bare);
        if (isInside(owner, real)) {
            if (migration) {
                unmeasured = true;
                return;
            }
            throw new Error("absolute project imports cannot be projected");
        }
    };
    const projectImport = (original) => {
        try {
            const real = prospective(original);
            if (!isInside(owner, real)) return null;
            const rel = path.relative(owner, real), file = path.join(view, rel);
            if (!stat(file)) copy(rel);
            return importTargetIsFile(file) ? file : null;
        } catch (error) {
            if (isAbsentImportError(error)) return null;
            throw error;
        }
    };
    const follow = (seeds, strict = false) => {
        const queue = seeds.map((seed) => ({ ...seed, depth: 0 })),
            seen = new Set();
        while (queue.length) {
            const { rel, depth, text: supplied, origin } = queue.shift(),
                file = path.join(view, rel);
            if (!stat(file)) copy(rel, strict);
            let real;
            try {
                real = fs.realpathSync(file);
            } catch (error) {
                if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
                throw error;
            }
            if (!isInside(view, real) || !fs.statSync(real).isFile() || seen.has(real)) continue;
            seen.add(real);
            const text = supplied ?? fs.readFileSync(real, "utf8");
            for (const { target: spelled, line } of importSpans(text)) {
                const bare = importPath(spelled);
                if (bare === null || bare.startsWith("~")) continue;
                if (path.isAbsolute(bare)) {
                    absolute(bare);
                    continue;
                }
                if (strict && depth === 0 && line.trim() !== `@${spelled}`)
                    throw new Error(`${rel} has an import the compiler cannot express`);
                if (!strict) {
                    const original = path.resolve(path.dirname(origin ?? path.join(root, rel)), bare);
                    const next = projectImport(original);
                    if (next && depth + 1 < IMPORT_DEPTH)
                        queue.push({ rel: path.relative(view, next), depth: depth + 1, origin: original });
                    continue;
                }
                const next = path.resolve(path.dirname(file), bare);
                if (!isInside(view, next)) {
                    const original = path.resolve(root, path.dirname(rel), bare);
                    if (strict || isInside(owner, prospective(original)))
                        throw new Error(`${rel} has an unmodeled project re-entry`);
                    continue;
                }
                if (depth + 1 >= IMPORT_DEPTH) continue;
                const nextRel = path.relative(view, next);
                if (!stat(next)) copy(nextRel, strict);
                queue.push({ rel: nextRel, depth: depth + 1 });
            }
        }
    };
    try {
        for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md", ...(hosts.includes("agents-md") ? ["AGENTS.md"] : [])])
            copy(rel);
        const nestedState = readNestedState(root, workspaceRel);
        copy(NESTED_REGISTRY, true);
        for (const row of nestedState.files) {
            parents(row.target);
            copy(row.target, true);
        }
        for (const edit of nestedState.cleanup) {
            parents(edit.file);
            copy(edit.file, true);
        }
        tree(
            ".claude/rules",
            (name) => name.endsWith(".md") || name === ".compiled" || name === path.basename(NESTED_REGISTRY),
            true,
        );
        tree(".claude/commands", (name) => name.endsWith(".md"), true);
        tree(".claude/agents", (name) => name.endsWith(".md"), false);
        if (copy(".claude/skills") && fs.statSync(path.join(root, ".claude/skills")).isDirectory()) {
            for (const item of fs.readdirSync(path.join(root, ".claude/skills"), { withFileTypes: true })) {
                if (item.isDirectory() || item.isSymbolicLink())
                    copy(path.join(".claude/skills", item.name, "SKILL.md"));
            }
        }
        for (const entry of before.flatMap((domain) => domain.entries)) {
            if (isInside(root, entry.file) || isInside(owner, entry.file)) copy(relative(entry.file));
            else projectImport(entry.file);
        }
        for (const name of GENERATED_DIRS) {
            const rel = path.join(workspaceRel, name),
                value = stat(path.join(root, rel));
            if (value && !value.isDirectory()) throw new Error(`${rel} has an unmodeled compiler boundary`);
        }
        const sourceDir = path.join(root, contextRel);
        if (stat(sourceDir)) {
            copy(contextRel, true);
            const scope = fs.realpathSync(path.join(root, workspaceRel));
            for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
                if (!item.name.endsWith(".md") || item.isDirectory()) continue;
                if (!(item.isFile() || item.isSymbolicLink()))
                    throw new Error(`${item.name} is not a regular guidance source`);
                const rel = path.join(contextRel, item.name),
                    real = fs.realpathSync(path.join(root, rel));
                if (!isInside(scope, real)) throw new Error(`${rel} resolves outside its workspace`);
                copy(rel, true);
            }
        }
        for (const [rel, file] of files) {
            if (!(file.ifAbsent && stat(path.join(root, rel)))) {
                writable(rel);
                if (file.contents === null) {
                    fs.rmSync(path.join(view, rel), { force: true });
                    materialized.add(rel);
                } else put(rel, file.contents);
            }
        }
        const context = path.join(view, contextRel);
        for (const item of fs.readdirSync(context, { withFileTypes: true })) {
            if (!item.name.endsWith(".md") || item.isDirectory()) continue;
            if (!(item.isFile() || item.isSymbolicLink()))
                throw new Error(`${item.name} is not a regular guidance source`);
            const rel = path.join(contextRel, item.name),
                file = path.join(view, rel);
            const unit = parseUnit(path.basename(item.name, ".md"), readOwnedText(file, view), rel);
            if (unit.target) {
                parents(unit.target);
                copy(unit.target, true);
            }
            if (unit.tier === "always") {
                for (const line of unit.body.split("\n")) {
                    const leads = LEADS_LINE.exec(line),
                        gates = GATES_LINE.exec(line),
                        found = leads ?? gates;
                    if (!found) continue;
                    const bare = leads ? found[1].split("#")[0] : found[1];
                    if (path.isAbsolute(bare) && (!migration || !isInside(root, bare)))
                        throw new Error(`${rel} has an absolute directive dependency`);
                    const next = path.isAbsolute(bare)
                        ? path.resolve(view, path.relative(root, bare))
                        : path.resolve(path.dirname(file), bare);
                    if (!isInside(view, next)) throw new Error(`${rel} names a dependency outside the project`);
                    if (!stat(next)) copy(path.relative(view, next), true);
                }
                const text = expandedBody(unit, path.dirname(file), view, manifest.packs ?? [], { originRoot: root });
                follow([{ rel, text }], true);
            } else {
                if (unit.tier === "on-invoke") {
                    const output = path.join(".claude/skills", unit.name, "SKILL.md");
                    parents(output);
                    const existing = stat(path.join(root, output));
                    if (existing && !existing.isFile())
                        throw new Error(`${output} is not an ordinary compiler output file`);
                }
                for (const { target: spelled } of importSpans(unit.body)) {
                    const bare = importPath(spelled);
                    if (bare === null || bare.startsWith("~") || path.isAbsolute(bare)) continue;
                    const next = path.resolve(path.dirname(file), bare);
                    if (!isInside(view, next)) {
                        if (!migration) throw new Error(`${rel} has an unmodeled import probe`);
                        if (remains(path.resolve(root, path.dirname(rel), bare)))
                            throw new Error(`${rel} has an import target that the compiler refuses`);
                        continue;
                    }
                    const original = path.join(root, path.relative(view, next));
                    const resolved = prospective(original);
                    const projected = isInside(owner, resolved)
                        ? path.join(view, path.relative(owner, resolved))
                        : null;
                    if ([next, projected].filter(Boolean).some(importTargetIsFile) || remains(original)) {
                        throw new Error(`${rel} has an import target that the compiler refuses`);
                    }
                }
            }
        }
        const plan = planGuidance(guidanceUnits(view, workspaceRel, { originRoot: root }), view, workspaceRel);
        for (const file of plan.owedFiles) {
            if (migration && !file.nested && !file.control) {
                const original = path.join(root, file.path),
                    entry = stat(original);
                if (entry?.isFile() && entry.nlink !== 1 && !fs.readFileSync(original).equals(Buffer.from(file.text)))
                    throw new Error(`${file.path} is a multiply linked guidance output`);
            }
            parents(file.path);
            if (!file.nested && !file.control) writable(file.path);
        }
        for (const file of plan.stray.filter((file) => file.removable && !file.nested)) {
            if (migration) {
                const entry = stat(path.join(root, file.path));
                if (entry?.isFile() && entry.nlink !== 1)
                    throw new Error(`${file.path} is a multiply linked guidance output`);
            }
            writable(file.path, true);
        }
        if (checkWrites) preflightNestedEdits(root, plan.nested.edits);
        compileGuidance(path.join(view, workspaceRel), { originRoot: root });
        if (compileGuidance(path.join(view, workspaceRel), { check: true, originRoot: root }).drifted)
            throw new Error("the prospective source set did not regenerate clean guidance");
        const nativeOrigins = new Map();
        const materializeImport = ({ source, bare, depth }) => {
            if (path.isAbsolute(bare)) {
                absolute(bare);
                return null;
            }
            const from = depth === 0 ? path.join(root, path.relative(view, source))
                : nativeOrigins.get(source) ?? path.join(root, path.relative(view, source));
            const original = path.resolve(path.dirname(from), bare), file = projectImport(original);
            if (file && !nativeOrigins.has(file)) nativeOrigins.set(file, original);
            return file;
        };
        return {
            before: before.map((domain) => domain.entries.reduce((sum, entry) => sum + entry.bytes, 0)),
            after: (() => {
                const values = hosts.map((host) =>
                    alwaysTier(view, { host, materializeImport }).entries.reduce((sum, entry) => sum + entry.bytes, 0),
                );
                return unmeasured ? null : values;
            })(),
        };
    } catch (error) {
        throw new Error(error.message.replaceAll(view, root));
    } finally {
        fs.rmSync(box, { recursive: true, force: true });
    }
}

export function previewMigration(tree, workspaceDir, edits) {
    const workspaceRel = path.relative(tree, workspaceDir) || ".";
    const files = new Map([
        [
            path.join(workspaceRel, "workspace.json"),
            { contents: fs.readFileSync(path.join(workspaceDir, "workspace.json"), "utf8") },
        ],
        ...edits.map((edit) => [edit.file, { contents: edit.next }]),
    ]);
    return previewAlways(tree, files, { workspaceRel, hosts: ["claude-code"], checkWrites: false, migration: true });
}
