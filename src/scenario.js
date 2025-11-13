import { log } from "./log.js";
import { sleep } from "./util.js";

export class ScenarioRunner {
  constructor(config) {
    this.config = config;
    // One global session for now; you can extend to per-conversation later
    this.session = null; // { scenarioId, index }
  }

  // Which scenario should we be running, if any?
  activeScenario() {
    const id = this.config.useScenario;
    if (!id) return null;
    return (
      (this.config.scenarios || []).find((scenario) => scenario.id === id) ||
      null
    );
  }

  /**
   * Advance the scenario by one step and return that step.
   * If no scenario is active or we've finished, returns null.
   *
   * NOTE: this does NOT write to res. Callers (routes) are responsible
   * for wrapping the step in the correct provider response shape.
   */
  async nextStep() {
    const scenario = this.activeScenario();
    if (!scenario) return null;

    // Initialize or reset session if needed
    if (!this.session || this.session.scenarioId !== scenario.id) {
      this.session = { scenarioId: scenario.id, index: 0 };
    }

    let step = scenario.steps?.[this.session.index];
    if (!step) {
      log("scenario.complete", { scenarioId: scenario.id });
      return null;
    }

    // Handle "wait" internally: advance index and sleep, then move to next meaningful step
    while (step && step.kind === "wait") {
      log("scenario.step", {
        scenarioId: scenario.id,
        index: this.session.index,
        kind: step.kind,
        ms: step.ms || 0,
      });

      const delay = step.ms || 0;
      if (delay > 0) {
        await sleep(delay);
      }

      this.session.index += 1;
      step = scenario.steps?.[this.session.index];
    }

    if (!step) {
      log("scenario.complete", { scenarioId: scenario.id });
      return null;
    }

    log("scenario.step", {
      scenarioId: scenario.id,
      index: this.session.index,
      kind: step.kind,
    });

    // Advance for next time, and return this step to the caller
    this.session.index += 1;
    return step;
  }

  reset() {
    this.session = null;
  }
}
