// Starter tool definitions. "Load template" seeds the builder; these double as
// worked examples of well-described tools (per Anthropic's define-tools guide).

import type { ToolDef, ToolState } from "./types";

export function blankTool(): ToolDef {
  return { name: "", description: "", params: [] };
}

export function blankState(): ToolState {
  return { tool: blankTool() };
}

export interface ToolTemplate {
  id: string;
  title: string;
  blurb: string;
  tool: ToolDef;
}

export const TOOL_TEMPLATES: ToolTemplate[] = [
  {
    id: "get_weather",
    title: "get_weather",
    blurb: "Classic location + unit lookup — the canonical example",
    tool: {
      name: "get_weather",
      description:
        "Get the current weather for a given location. Returns temperature and conditions for the specified city. Use when the user asks about current or near-term weather. It does not return forecasts beyond the current conditions.",
      whenToUse: "The user asks about the current weather, temperature, or conditions somewhere.",
      whenNotToUse: "The user asks for a multi-day forecast or historical weather.",
      params: [
        {
          key: "location",
          type: "string",
          description: "The city and state/country, e.g. 'San Francisco, CA'.",
          required: true,
        },
        {
          key: "unit",
          type: "enum",
          description: "Temperature unit to return.",
          required: false,
          enumValues: ["celsius", "fahrenheit"],
        },
      ],
    },
  },
  {
    id: "search_database",
    title: "search_database",
    blurb: "Filtered search with a result limit",
    tool: {
      name: "search",
      namespace: "db",
      description:
        "Search the application database for records matching a free-text query. Returns the most relevant rows up to the requested limit, ordered by relevance. Use this to look up existing records before creating new ones; it is read-only and never mutates data.",
      whenToUse: "You need to find existing records by keyword before answering or acting.",
      params: [
        { key: "query", type: "string", description: "Free-text search terms.", required: true },
        {
          key: "limit",
          type: "integer",
          description: "Maximum number of results to return (default 10).",
          required: false,
        },
      ],
    },
  },
  {
    id: "send_email",
    title: "send_email",
    blurb: "A write/action tool with required recipients",
    tool: {
      name: "send_email",
      description:
        "Send an email on the user's behalf. Delivers the message to the listed recipients with the given subject and body. Use only after the user has confirmed the recipients and content — this performs a real, non-reversible send.",
      whenToUse: "The user has explicitly asked to send an email and confirmed the details.",
      whenNotToUse: "You are still drafting or the user has not confirmed recipients.",
      params: [
        {
          key: "to",
          type: "array",
          itemType: "string",
          description: "Recipient email addresses.",
          required: true,
        },
        { key: "subject", type: "string", description: "Email subject line.", required: true },
        { key: "body", type: "string", description: "Plain-text email body.", required: true },
      ],
    },
  },
];
