import {
  getExpectedContexts,
  getMatrixContexts,
  toFiniteNumber,
} from "./validation.js";

function inferMutationContexts(...matrices) {
  const sbs96 = getExpectedContexts({ profile: "SBS", matrix: 96 });
  const contexts = getMatrixContexts(...matrices);

  if (
    contexts.length <= sbs96.length &&
    contexts.every((context) => sbs96.includes(context))
  ) {
    return sbs96;
  }

  return contexts;
}

function vectorFromRecord(record, contexts) {
  return contexts.map((context) => {
    const value = toFiniteNumber(record?.[context]);
    return value === null ? 0 : value;
  });
}

export {
  inferMutationContexts,
  vectorFromRecord,
};
