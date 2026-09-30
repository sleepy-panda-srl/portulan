#!/usr/bin/env node
// Mint a short-lived GitHub App installation token for the agent identity, and print it.
// Exit 0 token printed · 1 GitHub refused · 2 could not run.

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
    // Not String.replace, which would read a `$` in HOME as a replacement pattern.
    const resolved = keyPath.startsWith("~/") ? join(homedir(), keyPath.slice(2)) : keyPath;
    privateKey = readFileSync(resolved, "utf8");
} catch (e) {
    die(2, `cannot read the private key at ${keyPath}: ${e.code ?? e.message}`);
}

const b64url = (input) => Buffer.from(input).toString("base64url");
const now = Math.floor(Date.now() / 1000);

// `iat` is backdated a minute: GitHub rejects an issue time in its future, and clocks skew.
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
        if (res.status === 401) hint = " — the private key does not match the App, or this machine's clock is skewed";
        if (res.status === 404) hint = " — no App with that id, or it is not installed on this repository";
        die(1, `GitHub returned ${res.status} for ${path}${hint}\n${body.slice(0, 400)}`);
    }
    return body ? JSON.parse(body) : {};
};

// Node exits 1 on an unhandled rejection, and 1 here means GitHub refused: a surprise must exit 2.
try {
    let installationId = process.env.PORTULAN_BOT_INSTALLATION_ID;

    if (!installationId) {
        const installations = await call("/app/installations");
        if (!Array.isArray(installations)) die(2, "unexpected response listing installations");
        if (installations.length === 0) {
            die(2, "the App is not installed anywhere — install it on the repository first");
        }
        if (installations.length > 1) {
            const ids = installations.map((i) => `${i.id} (${i.account?.login})`).join(", ");
            die(2, `the App has ${installations.length} installations — set PORTULAN_BOT_INSTALLATION_ID to one of: ${ids}`);
        }
        installationId = installations[0].id;
    }

    // Scoped here as well as on the installation, so widening the installation does not widen this token.
    const token = await call(`/app/installations/${installationId}/access_tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: ["portulan"] }),
    });
    if (!token.token) die(1, "GitHub returned no token in the response");

    process.stdout.write(token.token);
} catch (e) {
    die(2, `unexpected failure: ${e?.message ?? e}`);
}
