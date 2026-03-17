/**
 * Agent prompt barrel — re-exports all prompt functions and version constants.
 *
 * Usage:
 *   import { getPlannerPrompt, getExecutorPrompt, getSynthesizerPrompt } from './prompts/index.js';
 *   const systemPrompt = getPlannerPrompt(market);
 */

export { getPlannerPrompt, PROMPT_VERSION as PLANNER_PROMPT_VERSION } from './planner.js';
export { getExecutorPrompt, PROMPT_VERSION as EXECUTOR_PROMPT_VERSION } from './executor.js';
export { getSynthesizerPrompt, PROMPT_VERSION as SYNTHESIZER_PROMPT_VERSION } from './synthesizer.js';
