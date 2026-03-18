/**
 * Agent prompt barrel — re-exports all prompt functions.
 * Relocated from onesell-backend for v2 client-only architecture.
 */

export { getPlannerPrompt, PROMPT_VERSION as PLANNER_PROMPT_VERSION } from './planner.js';
export { getExecutorPrompt, PROMPT_VERSION as EXECUTOR_PROMPT_VERSION } from './executor.js';
export { getSynthesizerPrompt, PROMPT_VERSION as SYNTHESIZER_PROMPT_VERSION } from './synthesizer.js';
