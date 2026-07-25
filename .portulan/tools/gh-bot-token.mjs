#!/usr/bin/env node
// Mint a short-lived GitHub App installation token for the agent identity, and print it.
//
// Why this exists: an agent posting review replies through the maintainer's credentials makes
// the conversation read as human when it is not. On a repository whose doctrine turns on honest
// records, that is a provenance defect — see ../memory/agent-activity-is-attributable.md.
// A GitHub App posts as `<app-name>[bot]`, which is unambiguous without anyone having to trust
// a convention.
//
// Zero dependencies on purpose: `node:crypto` signs the JWT and the global `fetch` exchanges it.
// Adding a JWT library here would put a supply-chain dependency in the credential path, which is
// the last place it belongs.
//
// Usage — prefer the ./gh-bot wrapper, which keeps the token out of your shell history:
//     GH_TOKEN=$(node .portulan/tools/gh-bot-token.mjs) gh api ...
//
// Environment:
//     PORTULAN_BOT_APP_ID           the App's numeric id
//     PORTULAN_BOT_PRIVATE_KEY      path to the App's .pem private key (never inside this repo)
//     PORTULAN_BOT_INSTALLATION_ID  optional; discovered automatically when there is exactly one
//
// Exit 0 token printed · 1 GitHub refused · 2 could not run — the same contract the verify
// recipes use, so "misconfigured" is never mistaken for "GitHub said no".

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.github.com";

function die(code, message) {
    process.stderr.write(`gh-bot-token: ${message}\n`);
    process.exit(code);
}

const appId = process.env.PORTULAN_BOT_APP_ID;
const keyPath = process.env.PORTULAN_BOT_PRIVATE_KEY;

if (!appId) die(2, "PORTULAN_BOT_APP_ID is not set — see .portulan/tools/README.md");
if (!keyPath) die(2, "PORTULAN_BOT_PRIVATE_KEY is not set — see .portulan/tools/README.md");

let privateKey;
try {
    // Expanded rather than string-replaced: a `$` anywhere in HOME would be read as a
    // replacement pattern by String.replace and silently corrupt the path.
    const resolved = keyPath.startsWith("~/") ? join(homedir(), keyPath.slice(2)) : keyPath;
    privateKey = readFileSync(resolved, "utf8");
} catch (e) {
    die(2, `cannot read the private key at ${keyPath}: ${e.code ?? e.message}`);
}

// ---------------------------------------------------------------------------- the JWT
const b64url = (input) => Buffer.from(input).toString("base64url");
const now = Math.floor(Date.now() / 1000);

// `iat` is backdated a minute because GitHub rejects a token whose issue time is in its future,
// and clock skew between this machine and GitHub is the ordinary cause. `exp` is deliberately
// short: this JWT only ever buys the installation token below.
const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));

let signature;
try {
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${payload}`);
    signature = signer.sign(privateKey).toString("base64url");
} catch (e) {
    die(2, `could not sign with that key — is it the App's PEM? (${e.message})`);
}
const jwt = `${header}.${payload}.${signature}`;

// ------------------------------------------------------------------- the installation token
const call = async (path, init = {}) => {
    let res;
    try {
        res = await fetch(`${API}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${jwt}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "portulan-agent",
                ...(init.headers ?? {}),
            },
        });
    } catch (e) {
        die(2, `network error talking to GitHub: ${e.message}`);
    }
    const body = await res.text();
    if (!res.ok) {
        let hint = "";
        // Observed rather than assumed: a nonexistent App id returns 404 "Integration not found",
        // not 401, so the hint has to cover both causes or it sends you looking at the wrong one.
        if (res.status === 401) hint = " — the private key does not match the App, or this machine's clock is skewed";
        if (res.status === 404) hint = " — no App with that id, or it is not installed on this repository";
        die(1, `GitHub returned ${res.status} for ${path}${hint}\n${body.slice(0, 400)}`);
    }
    return body ? JSON.parse(body) : {};
};

// Everything below is wrapped because an *unanticipated* throw — a body that is not JSON, a
// response shape GitHub changes, a socket dying mid-read — would otherwise be an unhandled
// rejection, and Node exits 1 for those. Exit 1 in this script means "GitHub refused". Letting a
// broken script borrow that code is the same asymmetry ../memory/verify-preconditions-fail-closed.md
// exists for: "could not run" must never be reported as a verdict.
try {
    let installationId = process.env.PORTULAN_BOT_INSTALLATION_ID;

    if (!installationId) {
        const installations = await call("/app/installations");
        if (!Array.isArray(installations)) die(2, "unexpected response listing installations");
        if (installations.length === 0) {
            die(2, "the App is not installed anywhere — install it on the repository first");
        }
        if (installations.length > 1) {
            // Guessing here would silently post as the wrong installation, so it refuses instead.
            const ids = installations.map((i) => `${i.id} (${i.account?.login})`).join(", ");
            die(2, `the App has ${installations.length} installations — set PORTULAN_BOT_INSTALLATION_ID to one of: ${ids}`);
        }
        installationId = installations[0].id;
    }

    // Scoped to this repository explicitly. The installation is already limited to it, but that is
    // a setting someone can widen later; asking for the narrow token means widening the installation
    // does not silently widen every token this script has ever minted.
    const token = await call(`/app/installations/${installationId}/access_tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: ["portulan"] }),
    });
    if (!token.token) die(1, "GitHub returned no token in the response");

    process.stdout.write(token.token);
} catch (e) {
    // die() exits the process, so nothing intentional lands here — only genuine surprises.
    die(2, `unexpected failure: ${e?.message ?? e}`);
}
