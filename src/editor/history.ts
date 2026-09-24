import type { KiroProject } from "./types";
export interface History {
  present: KiroProject;
  past: KiroProject[];
  future: KiroProject[];
  transaction?: KiroProject;
}
export type Action =
  | { type: "edit"; project: KiroProject }
  | { type: "load"; project: KiroProject }
  | { type: "begin" | "end" | "undo" | "redo" };
export function historyReducer(s: History, action: Action): History {
  if (action.type === "load")
    return { present: action.project, past: [], future: [] };
  if (action.type === "begin")
    return s.transaction ? s : { ...s, transaction: s.present };
  if (action.type === "end")
    return !s.transaction
      ? s
      : {
          ...s,
          transaction: undefined,
          past:
            s.transaction === s.present
              ? s.past
              : [...s.past, s.transaction].slice(-50),
        };
  if (action.type === "edit")
    return action.project === s.present
      ? s
      : {
          ...s,
          present: action.project,
          past: s.transaction ? s.past : [...s.past, s.present].slice(-50),
          future: [],
        };
  if (action.type === "undo" && s.past.length)
    return {
      present: s.past.at(-1)!,
      past: s.past.slice(0, -1),
      future: [s.present, ...s.future].slice(0, 50),
    };
  if (action.type === "redo" && s.future.length)
    return {
      present: s.future[0],
      past: [...s.past, s.present].slice(-50),
      future: s.future.slice(1),
    };
  return s;
}
