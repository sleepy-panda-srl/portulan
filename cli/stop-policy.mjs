// Stop recipe deadline policy.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_STOP_TIMEOUT = 90;
export const STOP_HOOK_MARGIN = 60;
export const MAX_STOP_TIMEOUT = Math.floor((2 ** 31 - 1) / 1000) - STOP_HOOK_MARGIN;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function requireSpecMinor(manifest, minMinor, field) {
    const spec = manifest?.portulan?.spec;
    const version = typeof spec === "string" ? /^(\d+)\.(\d+)$/.exec(spec) : null;
    if (!version || Number(version[1]) !== 2 || Number(version[2]) < minMinor) {
        throw new Error(`${field} requires portulan.spec 2.${minMinor} or a later minor on major 2`);
    }
}

function validateTimeoutSeconds(seconds, field) {
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_STOP_TIMEOUT) {
        throw new Error(`${field} must be an integer from 1 to ${MAX_STOP_TIMEOUT} seconds`);
    }
}

export function readStopPolicy(manifest) {
    const verifySeconds = manifest?.verify?.stopTimeout;
    if (verifySeconds !== undefined) {
        requireSpecMinor(manifest, 14, "verify.stopTimeout");
        validateTimeoutSeconds(verifySeconds, "verify.stopTimeout");
    }

    const recipes = Array.isArray(manifest?.verify?.recipes) ? manifest.verify.recipes : null;
    const stopRecipe = manifest?.verify?.stop;
    if (stopRecipe !== undefined) {
        requireSpecMinor(manifest, 17, "verify.stop");
        if (typeof stopRecipe !== "string" || !SLUG.test(stopRecipe)) {
            throw new Error("verify.stop must be a slug naming an own verify recipe");
        }
        if (!recipes || !recipes.some((r) => r?.id === stopRecipe)) {
            const ids = recipes ? recipes.map((r) => r?.id).filter(Boolean).join(", ") : "";
            throw new Error(`verify.stop names \`${stopRecipe}\`, which is not among the declared recipes (${ids || "none"})`);
        }
    }

    if (recipes) {
        for (let i = 0; i < recipes.length; i += 1) {
            const perRecipe = recipes[i]?.stopTimeout;
            if (perRecipe !== undefined) {
                const label = `verify.recipes[${i}].stopTimeout`;
                requireSpecMinor(manifest, 17, label);
                validateTimeoutSeconds(perRecipe, label);
            }
        }
    }

    const gateId = stopRecipe ?? (manifest?.verify?.default ?? null);
    const gateRecipe = recipes && gateId ? recipes.find((r) => r?.id === gateId) ?? null : null;
    const recipeSeconds = gateRecipe?.stopTimeout;
    const seconds = recipeSeconds ?? verifySeconds ?? DEFAULT_STOP_TIMEOUT;
    const declared = verifySeconds !== undefined || recipeSeconds !== undefined;
    const source = recipeSeconds !== undefined ? "recipe" : verifySeconds !== undefined ? "verify" : "default";
    return { seconds, declared, gateId, stopRecipe: stopRecipe ?? null, source };
}

function digestKey(value) {
    return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function realTree(root) {
    try { return fs.realpathSync(root); } catch { return path.resolve(root); }
}

export function recipeDurationFile(root, recipeId, dir = process.env.PORTULAN_RECIPE_DURATIONS_DIR || os.tmpdir()) {
    return path.join(dir, `portulan-recipe-duration-${digestKey(realTree(root))}-${digestKey(recipeId)}.json`);
}

export function recordRecipeDuration(root, recipeId, { durationMs, outcome, timedOut = false, timeoutMs = null }, dir) {
    if (!root || !recipeId || !Number.isFinite(durationMs) || durationMs < 0) return false;
    const file = recipeDurationFile(root, recipeId, dir);
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({
            recipeId: String(recipeId),
            durationMs: Math.round(durationMs),
            outcome: outcome ?? null,
            timedOut: Boolean(timedOut),
            timeoutMs: Number.isFinite(timeoutMs) ? Math.round(timeoutMs) : null,
            recordedAt: new Date().toISOString(),
        }));
        return true;
    } catch {
        return false;
    }
}

export function readRecipeDuration(root, recipeId, dir) {
    if (!root || !recipeId) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(recipeDurationFile(root, recipeId, dir), "utf8"));
        if (!parsed || typeof parsed !== "object" || !Number.isFinite(parsed.durationMs) || parsed.durationMs < 0) return null;
        return parsed;
    } catch {
        return null;
    }
}
