// Agent output for any recipe: one green count, complete failure streams.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { runRecipe } from "./recipe-runner.mjs";

function spools(tmpdir) {
    const dir = fs.mkdtempSync(path.join(tmpdir, "portulan-recipe-output-"));
    const descriptors = [];
    try {
        for (const name of ["stdout", "stderr"]) {
            const file = path.join(dir, name);
            descriptors.push(fs.openSync(file, "wx+", 0o600));
            fs.unlinkSync(file);
        }
        fs.rmdirSync(dir);
        return descriptors;
    } catch (error) {
        for (const fd of descriptors) { try { fs.closeSync(fd); } catch {} }
        fs.rmSync(dir, { recursive: true, force: true });
        throw error;
    }
}

async function replay(fd, destination) {
    function* chunks() {
        const buffer = Buffer.alloc(64 * 1024);
        let offset = 0;
        for (;;) {
            const bytes = fs.readSync(fd, buffer, 0, buffer.length, offset);
            if (bytes === 0) break;
            offset += bytes;
            yield Buffer.from(buffer.subarray(0, bytes));
        }
    }
    await pipeline(Readable.from(chunks()), destination, { end: false });
}

export async function execute(command, { root = process.cwd(), env = process.env, tmpdir = os.tmpdir(), stdout = process.stdout, stderr = process.stderr, timeout = 600_000 } = {}) {
    let descriptors = [];
    try {
        if (typeof command !== "string" || !command.trim()) throw new Error("one nonempty recipe command is required");
        descriptors = spools(tmpdir);
        const inherited = env.PORTULAN_RECIPE_MANAGED === "1";
        const groupId = Number(env.PORTULAN_RECIPE_GROUP);
        if (inherited && process.platform !== "win32") {
            const actual = Number(execFileSync("ps", ["-o", "pgid=", "-p", String(process.pid)], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "pipe"] }).trim());
            if (!Number.isInteger(groupId) || groupId <= 1 || actual !== groupId) throw new Error("inherited recipe group does not own this executor");
        }
        const result = await runRecipe({ id: "recipe", run: command }, {
            root, env, timeout: inherited ? 0 : timeout, mergeOutput: false, inheritGroup: inherited, groupId,
            onOutput: (name, chunk) => {
                const fd = descriptors[name === "stdout" ? 0 : 1];
                let offset = 0;
                while (offset < chunk.length) {
                    let wrote;
                    try { wrote = fs.writeSync(fd, chunk, offset, chunk.length - offset); }
                    catch (error) { stderr.write(`recipe-output: could not run — ${error.message}\n`); throw error; }
                    if (wrote <= 0) throw new Error("output spool made no write progress");
                    offset += wrote;
                }
            },
        });
        if (result.outcome !== "green") {
            await replay(descriptors[0], stdout);
            await replay(descriptors[1], stderr);
            if (result.diagnostics?.length) stderr.write(`recipe-output: could not run — ${result.diagnostics.join("; ")}\n`);
        }
        for (const fd of descriptors) fs.closeSync(fd);
        descriptors = [];
        if (result.outcome === "green") { await pipeline(Readable.from(["GREEN — 1 recipe passed\n"]), stdout, { end: false }); return 0; }
        return result.code ?? 2;
    } catch (error) {
        stderr.write(`recipe-output: could not run — ${error.message}\n`);
        return 2;
    } finally {
        for (const fd of descriptors) { try { fs.closeSync(fd); } catch {} }
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--") {
        process.stderr.write("usage: node cli/recipe-output.mjs -- <recipe-command>\n");
        process.exitCode = 2;
    } else process.exitCode = await execute(args[1]);
}
