/**
 * `rule-carriers` — the rail that keeps a reduced rule reduced.
 *
 * A registered rule's other spellings may appear only in its carrier, or beside a citation of it.
 *
 * Exit 0 green · 1 a registered spelling outside its carrier, uncited · 2 could not run.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Thrown for every exit-2 condition. Carries the sentence the wrapper prints. */
export class RegistryError extends Error {}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseRegistry(source, { where = "registry" } = {}) {
    let raw;
    try {
        raw = JSON.parse(source);
    } catch (cause) {
        throw new RegistryError(`${where} does not parse as JSON — ${cause.message}`);
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        throw new RegistryError(`${where} must be a JSON object`);
    }
    if (!Array.isArray(raw.rules)) {
        throw new RegistryError(`${where} declares no \`rules\` array — could-not-run rather than a set covering nothing`);
    }
    if (raw.rules.length === 0) {
        throw new RegistryError(`${where} declares zero rules — refusing to report green over an empty registry`);
    }

    const seen = new Set();
    const rules = raw.rules.map((rule, i) => {
        const at = `${where} rule ${i}`;
        if (!rule || typeof rule !== "object" || Array.isArray(rule)) throw new RegistryError(`${at} is not an object`);
        const { id, carrier, summary, incident, tells, cites, scope, exclude } = rule;

        if (typeof id !== "string" || !SLUG.test(id)) {
            throw new RegistryError(`${at} has an \`id\` that is not a slug: ${JSON.stringify(id)}`);
        }
        if (seen.has(id)) throw new RegistryError(`${where} declares the rule \`${id}\` more than once`);
        seen.add(id);

        for (const [key, value] of [["carrier", carrier], ["summary", summary], ["incident", incident]]) {
            if (typeof value !== "string" || value.trim() === "") {
                throw new RegistryError(`${at} (\`${id}\`) has no usable \`${key}\``);
            }
        }
        for (const [key, value] of [["tells", tells], ["cites", cites], ["scope", scope]]) {
            if (!Array.isArray(value) || value.length === 0) {
                throw new RegistryError(`${at} (\`${id}\`) has no usable \`${key}\` — a non-empty array is required`);
            }
            for (const entry of value) {
                if (typeof entry !== "string" || entry.trim() === "") {
                    throw new RegistryError(`${at} (\`${id}\`) has an empty entry in \`${key}\``);
                }
                if (entry !== entry.trim()) {
                    throw new RegistryError(
                        `${at} (\`${id}\`) has an untrimmed entry in \`${key}\`: ${JSON.stringify(entry)} — ` +
                            "leading or trailing whitespace silently changes what it matches",
                    );
                }
            }
        }
        if (exclude !== undefined) {
            if (!Array.isArray(exclude) || exclude.some((e) => typeof e !== "string" || e.trim() === "")) {
                throw new RegistryError(`${at} (\`${id}\`) has an unusable \`exclude\``);
            }
            for (const entry of exclude) {
                if (entry !== entry.trim()) {
                    throw new RegistryError(
                        `${at} (\`${id}\`) has an untrimmed entry in \`exclude\`: ${JSON.stringify(entry)} — ` +
                            "leading or trailing whitespace silently changes what it matches",
                    );
                }
            }
        }
        return {
            id,
            carrier,
            summary,
            incident,
            tells: [...tells],
            cites: [...cites],
            scope: [...scope],
            exclude: exclude ? [...exclude] : [],
        };
    });

    // `startsWith` coerces its argument: `[]` or `""` would match every path and exclude the whole tree.
    if (raw.exclude !== undefined) {
        if (!Array.isArray(raw.exclude)) {
            throw new RegistryError(`${where} has an \`exclude\` that is not an array`);
        }
        for (const entry of raw.exclude) {
            if (typeof entry !== "string" || entry.trim() === "") {
                throw new RegistryError(`${where} has an unusable entry in \`exclude\`: ${JSON.stringify(entry)}`);
            }
            if (entry !== entry.trim()) {
                throw new RegistryError(
                    `${where} has an untrimmed entry in \`exclude\`: ${JSON.stringify(entry)} — ` +
                        "leading or trailing whitespace silently changes what it matches",
                );
            }
        }
    }

    return { rules, exclude: Array.isArray(raw.exclude) ? [...raw.exclude] : [] };
}

export function inDomain(file, rule, globalExclude = []) {
    // Exported, so a hand-built rule may lack the arrays `parseRegistry` guarantees.
    const ruleExclude = Array.isArray(rule.exclude) ? rule.exclude : [];
    const scope = Array.isArray(rule.scope) ? rule.scope : [];
    const excluded = [...globalExclude, ...ruleExclude].some((p) => file === p || file.startsWith(p));
    if (excluded) return false;
    return scope.some((p) => file === p || file.startsWith(p));
}

/** Text as a reader reads it, so a tell matches across links, emphasis, code spans and line wraps. */
export function normalise(text) {
    return text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .toLowerCase();
}

const lower = normalise;

/** `resolve` defaults to `path.resolve`, never identity: `./cli/x.mjs` and `cli/x.mjs` name one carrier. */
export function scan({ registry, files, read, resolve = (p) => path.resolve(p) }) {
    const findings = [];
    const unreadable = [];
    // rule id → tell → seen, nested rather than a joined key, since a tell may hold any separator.
    const tellSeen = new Map();

    const carrierId = new Map();

    for (const rule of registry.rules) {
        const seen = new Map();
        for (const tell of rule.tells) seen.set(tell, false);
        tellSeen.set(rule.id, seen);
        carrierId.set(rule.id, resolve(rule.carrier));
    }

    for (const file of files) {
        let text;
        try {
            text = read(file);
        } catch (cause) {
            unreadable.push({ file, message: cause.message });
            continue;
        }
        const hay = lower(text);
        const fileId = resolve(file);

        for (const rule of registry.rules) {
            const isCarrier = fileId === carrierId.get(rule.id);

            const hits = rule.tells.filter((t) => hay.includes(lower(t)));
            for (const t of hits) tellSeen.get(rule.id).set(t, true);

            if (isCarrier || hits.length === 0) continue;
            if (!inDomain(file, rule, registry.exclude)) continue;

            const cited = rule.cites.some((c) => hay.includes(lower(c)));
            if (cited) continue;

            findings.push({ rule: rule.id, file, tells: hits, carrier: rule.carrier });
        }
    }

    const deadTells = [];
    for (const [ruleId, tells] of tellSeen) {
        for (const [tell, found] of tells) {
            if (!found) deadTells.push({ rule: ruleId, tell });
        }
    }

    return { findings, deadTells, unreadable };
}

export function auditCarriers(registry, { state }) {
    const unusable = [];
    for (const rule of registry.rules) {
        const found = state(rule.carrier);
        if (found !== "file") unusable.push({ rule: rule.id, carrier: rule.carrier, state: found });
    }
    return unusable;
}

function readList(stdin) {
    const parts = stdin.split("\0").filter((p) => p !== "");
    return parts;
}

export function run(argv = [], { stdout = process.stdout, stderr = process.stderr, cwd = process.cwd(), stdin } = {}) {
    let registryPath = ".portulan/rule-carriers.json";
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--registry") {
            registryPath = argv[++i];
            if (registryPath === undefined) {
                stderr.write("rule-carriers: --registry needs a path\n");
                return 2;
            }
        } else {
            stderr.write(`rule-carriers: unknown argument \`${argv[i]}\`\n`);
            return 2;
        }
    }

    let registry;
    try {
        const abs = path.resolve(cwd, registryPath);
        registry = parseRegistry(fs.readFileSync(abs, "utf8"), { where: registryPath });
    } catch (cause) {
        stderr.write(`rule-carriers: ${cause instanceof RegistryError ? cause.message : `cannot read ${registryPath} — ${cause.message}`}\n`);
        return 2;
    }

    // `statSync`, not `lstatSync`: a symlink to a file is a usable carrier.
    const unusable = auditCarriers(registry, {
        state: (p) => {
            let st;
            try {
                st = fs.statSync(path.resolve(cwd, p));
            } catch (cause) {
                if (cause.code === "ENOENT") return "absent";
                return `unreadable:${cause.code ?? cause.message}`;
            }
            return st.isFile() ? "file" : "not-a-file";
        },
    });
    if (unusable.length > 0) {
        for (const a of unusable) {
            if (a.state === "absent") {
                stderr.write(`rule-carriers: rule \`${a.rule}\` names a carrier that does not resolve: ${a.carrier}\n`);
            } else if (a.state.startsWith("unreadable:")) {
                stderr.write(
                    `rule-carriers: rule \`${a.rule}\` names a carrier this run could not examine: ${a.carrier} — ` +
                        `${a.state.slice("unreadable:".length)}. Refusing to call it missing: that is a fact about the ` +
                        "filesystem, not about the carrier, and the two want different repairs\n",
                );
            } else {
                stderr.write(
                    `rule-carriers: rule \`${a.rule}\` names a carrier that is not a file: ${a.carrier} — ` +
                        "it resolves, so this is not a typo, and it matches no file in the scan, which would leave the rule covering nothing\n",
                );
            }
        }
        return 2;
    }

    const all = readList(stdin ?? "");
    if (all.length === 0) {
        stderr.write("rule-carriers: the file list on stdin is empty — refusing to report green over nothing\n");
        return 2;
    }

    // The registry spells every tell, so scanning it would keep dead tells alive; resolved, as git's `/` is not every platform's.
    const registryAbs = path.resolve(cwd, registryPath);
    const files = all.filter((f) => path.resolve(cwd, f) !== registryAbs);

    const { findings, deadTells, unreadable } = scan({
        registry,
        files,
        read: (f) => fs.readFileSync(path.resolve(cwd, f), "utf8"),
        resolve: (p) => path.resolve(cwd, p),
    });

    if (unreadable.length > 0) {
        for (const u of unreadable) stderr.write(`rule-carriers: cannot read ${u.file} — ${u.message}\n`);
        return 2;
    }

    if (deadTells.length > 0) {
        for (const d of deadTells) {
            stderr.write(
                `rule-carriers: rule \`${d.rule}\` registers a tell that matches nothing in the tree: ${JSON.stringify(d.tell)}\n` +
                    "  Either the rule was rewritten and the registry was not, or the tell was wrong when it was written.\n",
            );
        }
        return 2;
    }

    if (findings.length > 0) {
        for (const f of findings) {
            stdout.write(
                `${f.file}: carries rule \`${f.rule}\` (${f.tells.map((t) => JSON.stringify(t)).join(", ")}) ` +
                    `without citing ${f.carrier}\n`,
            );
        }
        stdout.write(
            `\n${findings.length} carrier(s) restate a registered rule instead of citing it. ` +
                "Point the sentence at the carrier, or add the citation.\n",
        );
        return 1;
    }

    stdout.write(`rule-carriers: ${registry.rules.length} registered rule(s), ${files.length} file(s) examined, no restatement\n`);
    return 0;
}

/** URLs on both sides, since `import.meta.url` percent-encodes; the realpath covers a symlinked `bin`. */
function isMain() {
    const invoked = process.argv[1];
    if (!invoked) return false;
    if (import.meta.url === pathToFileURL(invoked).href) return true;
    try {
        return import.meta.url === pathToFileURL(fs.realpathSync(invoked)).href;
    } catch {
        return false;
    }
}

if (isMain()) {
    const chunks = [];
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
        process.exitCode = run(process.argv.slice(2), { stdin: Buffer.concat(chunks).toString("utf8") });
    });
}
