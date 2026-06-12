/** Shared types for the PM Hub assistant widget (native cal.diy side). */

export type AssistantMode = "test" | "ask" | "feedback";

/** Live context about where the tester is, sent to PM Hub with each request. */
export type PageContext = {
  route: string;
  projectId: string | null;
  user: string | null;
};
