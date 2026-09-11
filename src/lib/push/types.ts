export type PushMessage = {
  title: string;
  body: string;
  /** Path or absolute URL to open when tapped. */
  url?: string;
  /** Notifications with the same tag replace each other. */
  tag?: string;
};

export interface PushProvider {
  readonly name: string;
  send(tokens: string[], message: PushMessage): Promise<{ sent: number; invalidTokens: string[] }>;
}
