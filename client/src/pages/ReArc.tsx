/**
 * ReArc.tsx
 *
 * Author: Cascade (OpenAI Assistant)
 * Date: 2026-01-14
 * PURPOSE: Self-service page for generating RE-ARC datasets and evaluating solver predictions
 *          with timestamped provenance plus clarified benchmarking guidance.
 * SRP/DRY check: Pass — hero copy tweak only; existing sections reused.
 */

/* CONTEXT:
  The people who will find themselves at this page are those who created an ARC solver and
  want to see if it works and how well it does. They will probably have been directed here
  by the ARC community to prove their solver works or to demo how well it does, with proof.
  The ARC community can know for sure how well the solver works if the user shares their
  submission file with the community, as anyone can upload and evaluate, and it's tied directly
  to the same dataset, and there's an upper bound on how long it took for the solver to solve
  since it also encodes the generation timestamp.

  Though creating a solver is technical work, the user may not have a rigorous background in
  programming, and the ARC challenge is quite confusing, so we want the UX to be smooth and
  the copy to be well written, e.g. error messages should provide guidance and be helpful and
  actionable, and instructions should be clear.

TERMINOLOGY:
  - Predictions: solver output (pre-upload)
  - Submission: predictions after upload (the artifact)
  - Evaluation: process term for verifying all predictions and scoring
  - Verification: internal binary correctness check
  - Solutions: correct predictions (after evaluation)
*/

import { GenerationSection } from "@/components/rearc/GenerationSection";
import { EvaluationSection } from "@/components/rearc/EvaluationSection";
import { CollapsibleSection } from "@/components/rearc/CollapsibleSection";

const NUM_TASKS = 120;

export default function ReArc() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">RE-ARC Bench</h1>
          <p className="text-lg text-foreground/70">
            Verifiable benchmarking for ARC solvers
          </p>
        </div>

        <div className="text-sm text-foreground/90 bg-muted/50 p-4 rounded-md">
          <p className="mb-2">
            Click "Generate" to create a brand-new set of ARC puzzles.
            After your solver processes them, upload the results to calculate
            your score. Share the submission file with others to let them
            confirm your score independently—no trust required.
          </p>
          <p>
            The submission format and scoring is the same as the ARC Prize
            competition, so you can use this to test your solver before
            entering.
          </p>
        </div>

        <CollapsibleSection triggerText="About RE-ARC" triggerClassName="mt-3">
          <div className="mt-2 text-sm text-foreground/90 bg-muted/50 p-4 rounded-md">
            <div className="space-y-3">
              <div>
                <p className="font-semibold mb-1">Origin</p>
                <p>
                  RE-ARC (Reverse-Engineering the Abstraction and Reasoning
                  Corpus) was created by Michael Hodel as a synthetic data
                  generation framework. Each of the 400 ARC-AGI-1 training tasks
                  has a corresponding generator and verifier program.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">This Benchmark</p>
                <p>
                  RE-ARC Bench (Reproducible Evaluation of ARC) is a curated
                  120-task evaluation set created by David Lu. Construction
                  methodology: (1) removed all tasks solvable by the icecuber
                  solver (matching ARC-AGI-2's approach), (2) selected the 120
                  most complex tasks by verifier line count, (3) applied color
                  permutations and rotation/flip transforms so verifiers no
                  longer trivially solve the tasks (only 1/120 remain solvable
                  by verifiers; 0/120 by icecuber).
                  Difficulty roughly tracks the ARC-AGI-2 evaluation set, but this
                  tool is community-run and should not be mistaken for the official
                  validator.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Purpose</p>
                <p>
                  This tool serves multiple community needs: helping newcomers
                  understand submission formats, validating solver claims
                  without prolonged debates, enabling clean benchmarking without
                  overfitting to public datasets, and providing community
                  verification for novel approaches without waiting for official
                  semi-private evaluations.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Limitations</p>
                <p>
                  This is not an authoritative benchmark. While solutions to
                  the generated datasets are completely inaccessible, a
                  dedicated adversary could still create a brute force solver
                  for these specific 120 tasks. However, the development effort
                  required makes this impractical for casual claimants.
                  Additionally, RE-ARC has a fundamental limitation where it doesn't
                  determine if the example pairs of a task provide enough
                  information to solve the task, so some tasks may be
                  unsolvable.
                </p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          triggerText="How scoring works"
          triggerClassName="mt-2"
        >
          <div className="mt-2 text-sm text-foreground/90 bg-muted/50 p-4 rounded-md">
            <div className="space-y-3">
              <div>
                <p className="font-semibold mb-1">Per test input:</p>
                <p>
                  A test input is considered <strong>solved</strong> if{" "}
                  <strong>ANY</strong> of your 2 prediction attempts matches the
                  correct output. You only need one attempt to be correct.
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Per task:</p>
                <p>
                  Task score = (number of solved test inputs) / (total test
                  inputs in that task)
                </p>
              </div>

              <div>
                <p className="font-semibold mb-1">Overall score:</p>
                <p>
                  Your final score is the average of all task scores across the
                  submission.
                </p>
              </div>

              <div className="pt-2 border-t border-border/50">
                <p className="font-semibold mb-1">Example:</p>
                <p className="text-xs">
                  Task A has 2 test inputs. You solve 1 of them → Task A score:
                  1/2 = 0.5
                  <br />
                  Task B has 1 test input. You solve it → Task B score: 1/1 =
                  1.0
                  <br />
                  <strong>Overall score: (0.5 + 1.0) / 2 = 0.75 or 75%</strong>
                </p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          triggerText="Submission format guide"
          triggerClassName="mt-2"
        >
          <div className="mt-2 text-sm text-foreground/90 bg-muted/50 p-4 rounded-md">
            <p className="mb-3">
              ARC tasks contain test inputs (input grids). Each task has one or
              more test inputs. For each test input, your solver makes two
              prediction attempts to generate the correct output.
            </p>

            <p className="mb-2 font-semibold">Type:</p>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto mb-3 font-mono">
              {`type Submission = {
  [taskId: string]: Prediction[];
}
type Prediction = {
    attempt_1: Grid;
    attempt_2: Grid;
}
type Grid = number[][]`}
            </pre>

            <p className="mb-2 font-semibold">
              Example (second task has two test inputs):
            </p>
            <pre className="bg-background p-3 rounded text-xs overflow-x-auto">
              {`{
  "abc12345": [
    {
      "attempt_1": [[0, 1], [2, 3]],
      "attempt_2": [[2, 3], [0, 1]]
    }
  ],
  "1234abcd": [
    {
      "attempt_1": [[1, 2], [3, 4]],
      "attempt_2": [[3, 4], [1, 2]]
    },
    {
      "attempt_1": [[5, 6], [7, 8]],
      "attempt_2": [[7, 8], [5, 6]]
    }
  ]
}`}
            </pre>
          </div>
        </CollapsibleSection>
      </div>

      <GenerationSection numTasks={NUM_TASKS} />
      <EvaluationSection numTasks={NUM_TASKS} />
    </div>
  );
}
