export type SequentialStepOutcome<TStep, TResult> = {
  step: TStep;
  status: "success" | "failed";
  result?: TResult;
  error?: string;
};

/**
 * Runs every step in order and captures failures independently so earlier
 * evidence is never discarded when a later operation fails.
 */
export async function runStepsSequentially<TStep, TResult>(
  steps: TStep[],
  execute: (step: TStep) => Promise<TResult>
): Promise<SequentialStepOutcome<TStep, TResult>[]> {
  const outcomes: SequentialStepOutcome<TStep, TResult>[] = [];

  for (const step of steps) {
    try {
      outcomes.push({ step, status: "success", result: await execute(step) });
    } catch (error) {
      outcomes.push({
        step,
        status: "failed",
        error: error instanceof Error ? error.message : "Falha desconhecida na execução.",
      });
    }
  }

  return outcomes;
}
