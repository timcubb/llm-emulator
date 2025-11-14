import { log } from "./log.js";
import { sleep } from "./util.js";
import { extractVarsLoosely } from "./patterns.js";

/**
 * A single ScenarioRunner instance, created per server (in middleware.js).
 * It reads from config.useScenario + config.scenarios.
 *
 * Supports:
 * - Linear scenarios: { id, steps: [ { kind, reply, delayMs? }, ... ] }
 * - Graph scenarios:  { id, start, steps: { stateId: { branches: [...] , final? }, ... } }
 */
export class ScenarioRunner {
  constructor(config) {
    this.config = config;
    // One global session for now; can be extended to per-conversation later.
    this.session = null; // { scenarioId, mode, index?, stateId?, done? }
  }

  /**
   * Resolve the currently configured scenario from config.useScenario.
   */
  activeScenario() {
    const id = this.config.useScenario;
    if (!id) return null;
    return (this.config.scenarios || []).find((s) => s.id === id) || null;
  }

  /**
   * Determine if a scenario spec is graph-style (branching) or linear.
   */
  isGraphScenario(sc) {
    return (
      sc &&
      typeof sc.start === "string" &&
      sc.steps &&
      !Array.isArray(sc.steps)
    );
  }

  isLinearScenario(sc) {
    return sc && Array.isArray(sc.steps);
  }

  /**
   * Ensure we have a session for the active scenario, resetting if the id changed.
   */
  ensureSessionFor(sc) {
    if (!this.session || this.session.scenarioId !== sc.id) {
      const mode = this.isGraphScenario(sc)
        ? "graph"
        : this.isLinearScenario(sc)
        ? "linear"
        : "none";

      this.session = {
        scenarioId: sc.id,
        mode,
        index: 0,
        stateId: this.isGraphScenario(sc) ? sc.start : null,
        done: mode === "none",
      };
    }
    return this.session;
  }

  /**
   * Main entry point used by middleware:
   *
   *   const step = await scenarios.nextStep({ provider, model, text, headers, params });
   *
   * Returns:
   *   - a step object: { kind: "chat" | "tools", reply?, result? }
   *   - or null if no scenario / no matching branch / scenario finished
   */
  async nextStep(ctx = {}) {
    const sc = this.activeScenario();
    if (!sc) return null;

    const session = this.ensureSessionFor(sc);
    if (session.done || session.mode === "none") {
      return null;
    }

    if (session.mode === "graph") {
      return this.nextGraphStep(sc, session, ctx);
    }

    if (session.mode === "linear") {
      return this.nextLinearStep(sc, session);
    }

    return null;
  }

  /**
   * Original linear behavior: walk sc.steps[index++].
   * This assumes config.scenarios[i].steps is an array of step objects:
   *   { kind: "chat" | "tools", reply?, result?, delayMs? }
   */
  async nextLinearStep(sc, session) {
    const steps = sc.steps || [];
    const idx = session.index ?? 0;

    if (idx >= steps.length) {
      session.done = true;
      return null;
    }

    const step = steps[idx];

    // Optional per-step delay (for more realistic demos)
    if (step.delayMs && step.delayMs > 0) {
      await sleep(step.delayMs);
    }

    log("scenario.step", {
      scenarioId: sc.id,
      index: idx,
      kind: step.kind,
      mode: "linear",
    });

    session.index = idx + 1;
    if (session.index >= steps.length) {
      session.done = true;
    }

    return {
      kind: step.kind || "chat",
      reply: step.reply,
      result: step.result,
    };
  }

  /**
   * Graph/branching behavior:
   * - sc.steps is a map: { [stateId]: { branches: [...], final? } }
   * - session.stateId is the current state
   * - ctx.text is the last user text (from the request)
   *
   * Each branch can look like:
   *   {
   *     when: "my last name is {{lastName}}",
   *     if: (vars, ctx) => boolean (optional),
   *     kind: "chat" | "tools",
   *     reply?: string | (args) => string,
   *     result?: any,
   *     next?: "nextStateId"
   *   }
   */
  async nextGraphStep(sc, session, ctx) {
    const steps = sc.steps || {};
    const currentId = session.stateId;

    if (!currentId) {
      session.done = true;
      return null;
    }

    const state = steps[currentId];
    if (!state) {
      session.done = true;
      return null;
    }

    // If state is terminal and has no branches, we are done.
    if (state.final && !state.branches) {
      session.done = true;
      return null;
    }

    const branches = state.branches || [];
    const text = ctx.text || "";

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      const pattern = branch.when;
      if (!pattern) continue;

      const vars = extractVarsLoosely(text, pattern);
      if (!vars) {
        // pattern didn't match
        continue;
      }

      // Optional guard
      if (typeof branch.if === "function") {
        const ok = branch.if(vars, ctx);
        if (!ok) continue;
      }

      // We have a matching branch.
      let reply = undefined;
      let result = branch.result;

      if (typeof branch.reply === "function") {
        reply = await branch.reply({ text, vars, stateId: currentId, branch, ctx });
      } else {
        reply = branch.reply;
      }

      const kind = branch.kind || "chat";

      log("scenario.step", {
        scenarioId: sc.id,
        stateId: currentId,
        branchIndex: i,
        kind,
        mode: "graph",
      });

      // Optional per-branch delay
      if (branch.delayMs && branch.delayMs > 0) {
        await sleep(branch.delayMs);
      }

      // Move to next state
      if (branch.next) {
        session.stateId = branch.next;
        const nextState = steps[branch.next];
        if (nextState && nextState.final && !nextState.branches) {
          session.done = true;
        }
      } else if (state.final) {
        session.done = true;
      }

      return { kind, reply, result };
    }
    return null;
  }

  reset() {
    this.session = null;
  }
}
