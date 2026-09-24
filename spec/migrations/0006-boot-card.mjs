// A form step — the boot is a card, drafted from the workspace's own slots.
//
// Portulan's own boot became a card on 2026-09-24: an always unit that `portulan compile` writes into the
// rules the host loads into every context, so a session reads no slot to boot. This step drafts one for a
// consumer from its own files, the way `init` drafts one for a fresh repository, and `0007` compiles it:
// the identity imported whole, the leads of the principles and the definition of done and the gates of
// the policy written out by `compile`, each section naming its file. So the card says what the slots say,
// and moves when they move: an edit to any of them is drift until the card is recompiled.
//
// **Owed only where the workspace has not decided.** Where `slots.context` is undeclared, the card is
// drafted in `context/`, the slot is declared, and the manifest is stamped 2.10, the version that slot
// arrived in: a manifest declares what its content needs. Where the slot is declared, the workspace has
// decided, and a slot with no `boot` unit is a workspace that boots through its slots, as before.

import path from "node:path";

import { claudeRulesUnignore, draftCard, notYetForm, withIgnoreLines } from "../../cli/form.mjs";

/** The Workspace Definition version `slots.context` arrived in, which a manifest declaring it needs. */
const CONTEXT_SPEC = "2.10";

const posix = (p) => p.split(path.sep).join("/");

/** `declared`, or `CONTEXT_SPEC` where the declared version is older: never a version downwards. */
function atLeastContextSpec(declared) {
    const [major, minor] = String(declared).split(".").map(Number);
    const [needMajor, needMinor] = CONTEXT_SPEC.split(".").map(Number);
    return major > needMajor || (major === needMajor && minor >= needMinor) ? declared : CONTEXT_SPEC;
}

export const step = {
    id: "0006-boot-card",
    kind: "form",
    from: null,
    to: null,
    title: "the boot is a card, drafted from the workspace's own slots",
    why:
        "A boot through the slots reads the skill's steps and every slot file in full; a card carries the " +
        "same, compiled into the rules the host loads, and a session reads no slot to boot. `context/boot.md` " +
        "is drafted, `slots.context` declared at 2.10, and `0007` compiles it. Delete the card to boot as before.",

    owed(ws, ctx) {
        const behind = notYetForm(ws, ctx);
        if (behind) return { owed: false, because: behind };
        const kind = ws.manifest?.kind;
        if (kind !== "repository") return { owed: false, because: `a \`${kind}\` workspace has no repository of its own whose host would load a card` };
        if (!ws.repository) return { owed: false, because: "this workspace declares no tree for a card to load in" };
        if (typeof ws.manifest?.slots?.context === "string") {
            return { owed: false, because: "`slots.context` is declared: a `boot` unit in it is the card, and a slot without one boots through the slots" };
        }
        return { owed: true, because: "`slots.context` is undeclared, so a session boots by reading every slot; the card is drafted from them, and `0007` then compiles it" };
    },

    plan(ws) {
        if (ws.list().some((rel) => rel === "context" || rel.startsWith("context/"))) {
            return { ok: false, reason: "`context/` is already in the workspace and is no declared slot — rename it, or declare `slots.context` yourself, then upgrade" };
        }
        const manifest = {
            ...ws.manifest,
            portulan: { ...ws.manifest.portulan, spec: atLeastContextSpec(ws.manifest.portulan?.spec) },
            slots: { ...ws.manifest.slots, context: "context/" },
        };
        const tree = ws.repository.dir;
        const workspace = posix(path.relative(tree, ws.dir)) || ".";
        const inTree = (rel) => {
            const at = path.relative(tree, path.resolve(ws.dir, rel));
            return at !== "" && !at.startsWith("..") && !path.isAbsolute(at);
        };
        const read = (rel) => {
            try {
                return ws.read(rel);
            } catch {
                return null;
            }
        };
        const repos = typeof manifest.slots.repos === "string" ? manifest.slots.repos.replace(/\/?$/, "/") : null;
        const repoCards = repos === null
            ? []
            : ws.list().filter((rel) => rel.startsWith(repos) && rel.endsWith(".md") && !rel.slice(repos.length).includes("/") && path.posix.basename(rel) !== "README.md").map((rel) => path.posix.basename(rel, ".md"));

        const edits = [
            { file: "workspace.json", next: `${JSON.stringify(manifest, null, 2)}\n` },
            { file: "context/boot.md", next: draftCard(manifest, read, { workspace, inTree, repoCards }) },
        ];
        // A `.gitignore` that hides `.claude/` would keep the compiled card from review and from every
        // fresh checkout: the exceptions git needs, as git answers for this tree.
        const { lines } = claudeRulesUnignore(tree, ws.repository.git);
        if (lines.length) edits.push({ root: "tree", file: ".gitignore", next: withIgnoreLines(ws.repository.read(".gitignore"), lines) });
        return { ok: true, edits };
    },
};
