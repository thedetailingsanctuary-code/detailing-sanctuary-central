import "server-only";
import { getGraphAccessToken } from "@/lib/auth/token-store";

/** Minimal Microsoft Graph client. Read-only today; the same client will handle writes in phase 2. */
export type GraphDateTime = { dateTime: string; timeZone: string };

export type GraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  start: GraphDateTime;
  end: GraphDateTime;
  isAllDay?: boolean;
  isCancelled?: boolean;
  webLink?: string;
  location?: {
    displayName?: string;
    address?: { street?: string; city?: string; postalCode?: string; countryOrRegion?: string };
    coordinates?: { latitude?: number; longitude?: number };
  };
};

const GRAPH = "https://graph.microsoft.com/v1.0";

export async function graphFetch<T>(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<T> {
  const token = await getGraphAccessToken();
  const res = await fetch(path.startsWith("http") ? path : `${GRAPH}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GraphError(res.status, `Microsoft Graph ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 202 || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class GraphError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** All events overlapping [startIso, endIso). Instances of recurring events are expanded by Graph. */
export async function fetchCalendarView(startIso: string, endIso: string): Promise<GraphEvent[]> {
  const qs = new URLSearchParams({
    startDateTime: startIso,
    endDateTime: endIso,
    $select: "id,subject,bodyPreview,body,start,end,isAllDay,isCancelled,webLink,location",
    $orderby: "start/dateTime",
    $top: "50",
  });
  const out: GraphEvent[] = [];
  let url: string | null = `/me/calendarView?${qs.toString()}`;
  while (url) {
    const page: { value: GraphEvent[]; "@odata.nextLink"?: string } = await graphFetch(url, {
      headers: { Prefer: 'outlook.body-content-type="text"' },
    });
    out.push(...page.value);
    url = page["@odata.nextLink"] ?? null;
  }
  return out;
}
