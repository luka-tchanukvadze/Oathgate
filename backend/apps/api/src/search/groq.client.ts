import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Groq speaks the OpenAI request shape, so this is one fetch and no sdk
const BASE_URL = 'https://api.groq.com/openai/v1';

// The answer is one small json object from the fastest free provider there is
// Past this I would rather show plain text results than keep a person waiting
const TIMEOUT_MS = 2_500;

// Only read at boot, where a slower answer costs nobody anything
const BOOT_TIMEOUT_MS = 5_000;

// Free tier models get retired on somebody else's schedule, so this is a
// starting point and not a promise
// Overriding it is one environment variable and a restart, no code change
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

@Injectable()
export class GroqClient {
  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('GROQ_MODEL') ?? DEFAULT_MODEL;
  }

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('GROQ_API_KEY')?.trim());
  }

  // Proves the key works and the model id exists, and nothing beyond that
  // A listed model can still refuse a completion, which is a separate endpoint
  // with a quota of its own
  async listModels(): Promise<string[]> {
    const response = await this.send('/models', undefined, BOOT_TIMEOUT_MS);
    const body = (await response.json()) as { data?: { id?: string }[] };

    return (body.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string');
  }

  // Temperature zero because the same sentence should always read the same way
  // A search that returns different filters for one query is not a search
  async completeJson(system: string, user: string): Promise<unknown> {
    const response = await this.send(
      '/chat/completions',
      {
        model: this.model,
        temperature: 0,
        // The word json has to appear in the prompt for this mode to be allowed
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      TIMEOUT_MS,
    );

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = body.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('groq returned no content');
    }

    return JSON.parse(content);
  }

  private async send(
    path: string,
    payload: unknown,
    timeoutMs: number,
  ): Promise<Response> {
    const apiKey = this.config.get<string>('GROQ_API_KEY')?.trim();

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not set');
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      body: payload ? JSON.stringify(payload) : undefined,
      // Without a deadline a hung upstream holds the request open until the
      // browser gives up, which a merchant reads as my dashboard being broken
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // The body carries the real reason, and throwing it away is how a
      // retired model turns into an unexplained 500
      const detail = await response.text().catch(() => '');
      throw new Error(`groq ${response.status}: ${detail.slice(0, 200)}`);
    }

    return response;
  }
}
