import { isSupportedAge, needsHijabProfileCompletion } from "./profileRules";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
assert(!isSupportedAge(11), "age 11 must be rejected");
assert(isSupportedAge(12), "age 12 must be accepted");
assert(isSupportedAge(17), "age 17 must be accepted without a separate photo rule");
assert(isSupportedAge(18), "age 18 must be accepted");
assert(isSupportedAge(50), "age 50 must be accepted");
assert(!isSupportedAge(51), "age 51 must be rejected");
assert(needsHijabProfileCompletion("female", null), "existing female profiles without an answer must be prompted");
assert(!needsHijabProfileCompletion("female", "always"), "answered female profiles must not be prompted again");
assert(!needsHijabProfileCompletion("male", null), "non-female profiles must not be interrupted");
console.log("Profile age boundary acceptance checks passed");
