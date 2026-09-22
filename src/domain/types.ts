export interface CommentIdentity { identifier: string; host: string }
export interface ParsedComment extends CommentIdentity {
  element: HTMLLIElement;
  wordpressCommentId: string;
  commentNumber: string;
  suffix: string;
}
export interface BlockRules { identifiers: Set<string>; hosts: Set<string> }
export interface StoredBlockRules { version: 1; identifiers: string[]; hosts: string[] }
export type RuleChange =
  | { type: "add"; identifiers: string[]; hosts: string[] }
  | { type: "remove"; kind: "identifiers" | "hosts"; value: string };
