// Project guidance preview.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isInside } from "./inside.mjs";
import { alwaysTier } from "./context.mjs";
import { compileGuidance, guidanceUnits, planGuidance, GENERATED_DIRS, parseUnit, expandedBody, importSpans, importPath, IMPORT_DEPTH, LEADS_LINE, GATES_LINE } from "./compile.mjs";

export function outsideTempParents(target) {
    const owner = fs.realpathSync(target), found = [];
    for (const base of [os.tmpdir(), path.dirname(owner)]) {
        try { const real = fs.realpathSync(base); if (!isInside(owner, real) && fs.statSync(real).isDirectory() && !found.includes(real)) found.push(real); }
        catch {}
    }
    return found;
}

export function previewAlways(target, files) {
    const root = path.resolve(target), owner = fs.realpathSync(root), hosts = ["claude-code", "agents-md"];
    const before = hosts.map(host => {
        try { return alwaysTier(root, { host }); }
        catch (error) { throw new Error(`${host === "agents-md" ? "AGENTS.md" : "Claude Code"} could not be measured: ${error.message}`); }
    });
    for (const rel of [".claude", ".claude/rules", ".claude/rules/portulan", ".claude/skills"]) {
        let stat; try { stat = fs.lstatSync(path.join(root, rel)); } catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") continue; throw error; }
        if (!stat.isDirectory()) throw new Error(`${rel} is not an ordinary compiler output directory`);
    }
    let box, view;
    for (const base of outsideTempParents(target)) {
        try { box = fs.mkdtempSync(path.join(base, ".portulan-init-preview-")); view = path.join(box, path.basename(root)); fs.mkdirSync(view); break; }
        catch {}
    }
    if (!view) throw new Error("no writable scratch location outside the target");
    const prospective = (file, seen = new Set()) => {
        if (seen.has(file)) throw new Error("an import alias cannot be resolved");
        seen.add(file);
        let at = file, suffix = [];
        for (;;) {
            let value;
            try { value = fs.lstatSync(at); }
            catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
            if (value?.isSymbolicLink()) return prospective(path.resolve(path.dirname(at), fs.readlinkSync(at), ...suffix), seen);
            if (value) return path.resolve(fs.realpathSync(at), ...suffix);
            const parent = path.dirname(at);
            if (parent === at) throw new Error("an import cannot be resolved");
            suffix.unshift(path.basename(at)); at = parent;
        }
    };
    const writable = (rel, unlink = false) => {
        const file = path.join(root, rel);
        let value;
        try { value = fs.lstatSync(file); } catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
        if (value && !unlink) {
            if (!value.isFile() || value.nlink > 1) throw new Error(`${rel} is not an ordinary singly linked write target`);
            fs.accessSync(file, fs.constants.W_OK);
        } else {
            let dir = path.dirname(file);
            while (!fs.existsSync(dir)) dir = path.dirname(dir);
            fs.accessSync(dir, fs.constants.W_OK | fs.constants.X_OK);
        }
    };
    const materialized = new Set();
    const relative = file => {
        if (isInside(root, file)) return path.relative(root, file);
        if (isInside(owner, file)) return path.relative(owner, file);
        throw new Error("a required input lies outside the project");
    };
    const stat = file => {
        try { return fs.lstatSync(file); }
        catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") return null; throw error; }
    };
    const parents = rel => {
        const parts = rel.split(path.sep);
        for (let count = 1; count < parts.length; count++) {
            const current = path.join(root, ...parts.slice(0, count)), value = stat(current);
            if (!value) break;
            if (!value.isDirectory()) throw new Error(`${path.relative(root, current)} has an unmodeled ancestor type or alias`);
        }
    };
    const put = (rel, contents) => {
        const file = path.join(view, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); materialized.add(rel);
    };
    const copy = (rel, required = false) => {
        if (materialized.has(rel)) return true;
        const file = path.resolve(root, rel);
        if (!isInside(root, file)) throw new Error("a required input leaves the project");
        const value = stat(file); if (!value) return false;
        parents(rel);
        const destination = path.join(view, rel);
        if (value.isSymbolicLink()) {
            let real;
            try { real = fs.realpathSync(file); }
            catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
            let next;
            if (real) {
                if (!isInside(owner, real)) { if (required) throw new Error(`${rel} resolves outside its owner`); return false; }
                if (fs.statSync(real).isDirectory()) throw new Error(`${rel} has an unmodeled directory alias`);
                next = path.relative(owner, real);
            } else {
                const spelled = path.resolve(path.dirname(file), fs.readlinkSync(file));
                next = relative(spelled); parents(next);
            }
            copy(next, required);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.symlinkSync(path.relative(path.dirname(destination), path.join(view, next)), destination);
            materialized.add(rel); return true;
        }
        const real = fs.realpathSync(file);
        if (!isInside(owner, real)) throw new Error(`${rel} resolves outside its owner`);
        if (value.isDirectory()) fs.mkdirSync(destination, { recursive: true });
        else if (value.isFile()) put(rel, fs.readFileSync(real));
        else { if (required) throw new Error(`${rel} is not a regular input`); return false; }
        materialized.add(rel); return true;
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
            else if (select(item.name)) copy(child, child.startsWith(`.claude${path.sep}rules${path.sep}portulan${path.sep}`));
        }
    };
    const absolute = bare => {
        const real = prospective(bare);
        if (isInside(owner, real)) throw new Error("absolute project imports cannot be projected");
    };
    const follow = (seeds, strict = false) => {
        const queue = seeds.map(seed => ({ ...seed, depth: 0 })), seen = new Set();
        while (queue.length) {
            const { rel, depth, text: supplied } = queue.shift(), file = path.join(view, rel);
            if (!stat(file)) copy(rel, strict);
            let real; try { real = fs.realpathSync(file); } catch (error) { if (error.code === "ENOENT" || error.code === "ENOTDIR") continue; throw error; }
            if (!isInside(view, real) || !fs.statSync(real).isFile() || seen.has(real)) continue;
            seen.add(real);
            const text = supplied ?? fs.readFileSync(real, "utf8");
            for (const { target: spelled, line } of importSpans(text)) {
                const bare = importPath(spelled); if (bare === null || bare.startsWith("~")) continue;
                if (path.isAbsolute(bare)) { absolute(bare); continue; }
                if (strict && depth === 0 && line.trim() !== `@${spelled}`) throw new Error(`${rel} has an import the compiler cannot express`);
                const next = path.resolve(path.dirname(file), bare);
                if (!isInside(view, next)) {
                    const original = path.resolve(root, path.dirname(rel), bare);
                    if (strict || isInside(owner, prospective(original))) throw new Error(`${rel} has an unmodeled project re-entry`);
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
        for (const rel of ["CLAUDE.md", ".claude/CLAUDE.md", "AGENTS.md"]) copy(rel);
        tree(".claude/rules", name => name.endsWith(".md") || name === ".compiled", true);
        tree(".claude/commands", name => name.endsWith(".md"), true);
        tree(".claude/agents", name => name.endsWith(".md"), false);
        if (copy(".claude/skills") && fs.statSync(path.join(root, ".claude/skills")).isDirectory()) {
            for (const item of fs.readdirSync(path.join(root, ".claude/skills"), { withFileTypes: true })) {
                if (item.isDirectory() || item.isSymbolicLink()) copy(path.join(".claude/skills", item.name, "SKILL.md"));
            }
        }
        for (const entry of before.flatMap(domain => domain.entries)) copy(relative(entry.file));
        for (const name of GENERATED_DIRS) {
            const rel = path.join(".portulan", name), value = stat(path.join(root, rel));
            if (value && !value.isDirectory()) throw new Error(`${rel} has an unmodeled compiler boundary`);
        }
        const sourceDir = path.join(root, ".portulan/context");
        if (stat(sourceDir)) {
            copy(".portulan/context", true);
            const scope = fs.realpathSync(path.join(root, ".portulan"));
            for (const item of fs.readdirSync(sourceDir, { withFileTypes: true })) {
                if (!item.name.endsWith(".md") || !(item.isFile() || item.isSymbolicLink())) continue;
                const rel = path.join(".portulan/context", item.name), real = fs.realpathSync(path.join(root, rel));
                if (!isInside(scope, real)) throw new Error(`${rel} resolves outside its workspace`);
                copy(rel, true);
            }
        }
        for (const [rel, file] of files) {
            if (!(file.ifAbsent && stat(path.join(root, rel)))) { writable(rel); put(rel, file.contents); }
        }
        const context = path.join(view, ".portulan/context");
        for (const item of fs.readdirSync(context, { withFileTypes: true })) {
            if (!item.name.endsWith(".md") || !(item.isFile() || item.isSymbolicLink())) continue;
            const rel = path.join(".portulan/context", item.name), file = path.join(view, rel);
            const unit = parseUnit(path.basename(item.name, ".md"), fs.readFileSync(file, "utf8"), rel);
            if (unit.tier === "always") {
                for (const line of unit.body.split("\n")) {
                    const leads = LEADS_LINE.exec(line), gates = GATES_LINE.exec(line), found = leads ?? gates;
                    if (!found) continue;
                    const bare = leads ? found[1].split("#")[0] : found[1];
                    if (path.isAbsolute(bare)) throw new Error(`${rel} has an absolute directive dependency`);
                    const next = path.resolve(path.dirname(file), bare);
                    if (!isInside(view, next)) throw new Error(`${rel} names a dependency outside the project`);
                    if (!stat(next)) copy(path.relative(view, next), true);
                }
                const text = expandedBody(unit, path.dirname(file), view, files.get(".portulan/workspace.json") ? JSON.parse(files.get(".portulan/workspace.json").contents).packs ?? [] : []);
                follow([{ rel, text }], true);
            } else {
                if (unit.tier === "on-invoke") {
                    const output = path.join(".claude/skills", unit.name, "SKILL.md");
                    parents(output);
                    const existing = stat(path.join(root, output));
                    if (existing && !existing.isFile()) throw new Error(`${output} is not an ordinary compiler output file`);
                }
                for (const { target: spelled } of importSpans(unit.body)) {
                    const bare = importPath(spelled); if (bare === null || bare.startsWith("~") || path.isAbsolute(bare)) continue;
                    const next = path.resolve(path.dirname(file), bare);
                    if (!isInside(view, next)) throw new Error(`${rel} has an unmodeled import probe`);
                    const original = path.join(root, path.relative(view, next));
                    const resolved = prospective(original);
                    const projected = isInside(owner, resolved) ? path.join(view, path.relative(owner, resolved)) : null;
                    if ([next, original, projected].filter(Boolean).some(at => fs.statSync(at, { throwIfNoEntry: false })?.isFile())) {
                        throw new Error(`${rel} has an import target that the compiler refuses`);
                    }
                }
            }
        }
        const plan = planGuidance(guidanceUnits(view), view);
        for (const file of plan.owedFiles) writable(file.path);
        for (const file of plan.stray.filter(file => file.removable)) writable(file.path, true);
        compileGuidance(view);
        const materializeImport = ({ file, source, bare }) => {
            if (path.isAbsolute(bare)) { absolute(bare); return; }
            if (!isInside(view, file)) {
                const original = path.resolve(root, path.relative(view, path.dirname(source)), bare);
                if (isInside(owner, prospective(original))) throw new Error("an import has an unmodeled project re-entry");
                return;
            }
            if (!stat(file)) copy(path.relative(view, file));
        };
        return {
            before: before.map(domain => domain.entries.reduce((sum, entry) => sum + entry.bytes, 0)),
            after: hosts.map(host => alwaysTier(view, { host, materializeImport }).entries.reduce((sum, entry) => sum + entry.bytes, 0)),
        };
    } catch (error) { throw new Error(error.message.replaceAll(view, root)); }
    finally { fs.rmSync(box, { recursive: true, force: true }); }
}
