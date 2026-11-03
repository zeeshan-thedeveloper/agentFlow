export interface KnowledgeDocument {
  document: string;
  chunks: number;
  characters: number;
  addedAt: string;
}

interface KnowledgeTarget {
  integrationId: string;
  knowledgeBase: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/knowledge${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string | string[]; error?: string };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? body.error;
    throw new Error(message || 'Request failed');
  }
  return body;
}

const query = (params: Record<string, string>) => `?${new URLSearchParams(params)}`;

export const listKnowledgeDocuments = ({ integrationId, knowledgeBase }: KnowledgeTarget) =>
  request<{ documents: KnowledgeDocument[] }>(`/documents${query({ integrationId, knowledgeBase })}`).then(body => body.documents);

/** Chunks, embeds (with the user's OpenAI key) and stores a document; one with the same name is replaced. */
export const addKnowledgeDocument = (target: KnowledgeTarget, title: string, text: string) =>
  request<{ ok: boolean; document: string; chunks: number }>('/documents', {
    method: 'POST',
    body: JSON.stringify({ ...target, title, text }),
  });

export const deleteKnowledgeDocument = ({ integrationId, knowledgeBase }: KnowledgeTarget, document: string) =>
  request<{ ok: boolean }>(`/documents${query({ integrationId, knowledgeBase, document })}`, { method: 'DELETE' });
