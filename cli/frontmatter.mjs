// Flat frontmatter for plugin components and host bindings.

const BLOCK_SCALAR = /^[|>][+-]?$/;

/** A flat-YAML reader: `fields` is null without a usable block, and `error` is set when that is a defect. */
export function parseFrontmatter(text) {
    const lines = text.split(/\r?\n/);
    if (lines[0]?.trim() !== "---") return { fields: null };

    const close = lines.indexOf("---", 1);
    if (close === -1) {
        return { fields: null, error: "the frontmatter block is never closed" };
    }

    const fields = {};
    const body = lines.slice(1, close);
    for (let i = 0; i < body.length; i += 1) {
        const match = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(body[i]);
        if (!match) continue;
        const key = match[1];
        let value = match[2].trim();

        if (BLOCK_SCALAR.test(value)) {
            const collected = [];
            while (i + 1 < body.length && (body[i + 1].trim() === "" || /^\s+/.test(body[i + 1]))) {
                i += 1;
                collected.push(body[i].trim());
            }
            value = collected.join(" ").trim();
        } else if (
            (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
            (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
        ) {
            value = value.slice(1, -1);
        }
        fields[key] = value;
    }
    return { fields };
}
