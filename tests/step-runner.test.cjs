const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpile(source, {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  });
  module._compile(compiled, filename);
};

const { runStepsSequentially } = require("../lib/agent/step-runner.ts");

test("executes steps sequentially and preserves every successful result", async () => {
  const order = [];
  const outcomes = await runStepsSequentially(
    [{ id: "one" }, { id: "two" }],
    async (step) => {
      order.push(step.id);
      return `result-${step.id}`;
    }
  );

  assert.deepEqual(order, ["one", "two"]);
  assert.deepEqual(outcomes.map((item) => item.status), ["success", "success"]);
  assert.deepEqual(outcomes.map((item) => item.result), ["result-one", "result-two"]);
});

test("keeps earlier evidence and continues after an individual step fails", async () => {
  const order = [];
  const outcomes = await runStepsSequentially(
    [{ id: "one" }, { id: "two" }, { id: "three" }],
    async (step) => {
      order.push(step.id);
      if (step.id === "two") throw new Error("second step failed");
      return `result-${step.id}`;
    }
  );

  assert.deepEqual(order, ["one", "two", "three"]);
  assert.equal(outcomes[0].result, "result-one");
  assert.equal(outcomes[1].status, "failed");
  assert.equal(outcomes[1].error, "second step failed");
  assert.equal(outcomes[2].result, "result-three");
});

test("records non-Error failures without aborting the sequence", async () => {
  const outcomes = await runStepsSequentially(
    [{ id: "one" }],
    async () => { throw "unexpected"; }
  );

  assert.equal(outcomes[0].status, "failed");
  assert.equal(outcomes[0].error, "Falha desconhecida na execução.");
});
