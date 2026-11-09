// The demo's pinned bundle replacement reproduces its boot reduction without changing its workspace.

import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { demonstrateUpgrade, INPUTS, replaceBundle } from "./fixtures/generate-demo-upgrade.mjs";

const recorded = new URL("./fixtures/demo-upgrade/observations.json", import.meta.url);

test("pinned demo bundle upgrade reproduces both rosters and a separate migration no-op", () => {
    const result = demonstrateUpgrade();
    assert.equal(`${JSON.stringify(result, null, 2)}\n`, fs.readFileSync(recorded, "utf8"));
    assert.equal(result.before.bytes, 42958);
    assert.equal(result.after.bytes, 36250);
    assert.equal(result.savedBytes, 6708);
    assert.equal(result.workspaceUnchanged, true);
    assert.equal(result.migration.exit, 0);
    assert.match(result.migration.stdout, /owes nothing.*current at 2\.4/);
});

test("no bundle replacement cannot produce upgrade evidence", () => {
    assert.throws(() => demonstrateUpgrade({ replace: () => {} }), /replacement|snapshot|pinned/);
});

test("bundle replacement cannot alter workspace configuration or content", () => {
    for (const file of ["workspace.json", "identity.md"]) {
        assert.throws(() => demonstrateUpgrade({ replace: (args) => {
            replaceBundle(args);
            fs.appendFileSync(`${args.workspaceDir}/${file}`, "\nchanged\n");
        } }), /workspace changed/);
    }
});

test("wrong release, corrupt bytes and a different selected repository are refused", () => {
    const wrongRelease = structuredClone(INPUTS);
    wrongRelease.after.commit = wrongRelease.before.commit;
    assert.throws(() => demonstrateUpgrade({ inputs: wrongRelease }), /release/);
    const corrupt = structuredClone(INPUTS);
    corrupt.before.files[0].text += "changed";
    assert.throws(() => demonstrateUpgrade({ inputs: corrupt }), /digest|length/);
    assert.throws(() => demonstrateUpgrade({ repo: "fieldnotes" }), /Combcount/);
});
