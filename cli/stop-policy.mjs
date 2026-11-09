// Stop recipe deadline policy.
export const DEFAULT_STOP_TIMEOUT = 90;
export const STOP_HOOK_MARGIN = 60;
export const MAX_STOP_TIMEOUT = Math.floor((2 ** 31 - 1) / 1000) - STOP_HOOK_MARGIN;

export function readStopPolicy(manifest) {
    const seconds = manifest?.verify?.stopTimeout;
    if (seconds === undefined) return { seconds: DEFAULT_STOP_TIMEOUT, declared: false };
    const spec = manifest?.portulan?.spec;
    const version = typeof spec === "string" ? /^(\d+)\.(\d+)$/.exec(spec) : null;
    if (!version || Number(version[1]) !== 2 || Number(version[2]) < 14) throw new Error("verify.stopTimeout requires portulan.spec 2.14 or a later minor on major 2");
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_STOP_TIMEOUT) throw new Error(`verify.stopTimeout must be an integer from 1 to ${MAX_STOP_TIMEOUT} seconds`);
    return { seconds, declared: true };
}
