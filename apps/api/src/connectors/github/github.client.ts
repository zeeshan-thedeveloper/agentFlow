import type { Tool } from '../../handlers/tools/base.tool';

// Connected with a fine-grained personal access token: the user picks which
// repositories it covers when creating it on GitHub, and that is all an agent
// can reach.

const API = 'https://api.github.com';
const MAX_FILE_CHARS = 20_000;
const MAX_PATCH_CHARS = 3_000;
const REPO = /^[\w.-]+\/[\w.-]+$/;

export async function githubApi<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AgentFlow',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    const hint = response.status === 404 ? ' (the token may not have access to this repository)' : '';
    throw new Error(`GitHub API error ${response.status}: ${body?.message ?? response.statusText}${hint}`);
  }
  return (await response.json()) as T;
}

export async function githubIdentity(token: string) {
  const user = await githubApi<{ login: string }>(token, '/user');
  return { login: user.login };
}

function repoOf(args: Record<string, unknown>): string {
  const repo = String(args.repo ?? '').trim();
  if (!REPO.test(repo)) throw new Error('repo must look like "owner/name".');
  return repo;
}

function numberOf(args: Record<string, unknown>): number {
  const value = Number(args.number);
  if (!Number.isInteger(value) || value <= 0) throw new Error('number must be an issue or pull request number.');
  return value;
}

type Issue = {
  number: number;
  title: string;
  state: string;
  user?: { login: string };
  labels?: { name: string }[];
  comments?: number;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
  body?: string | null;
  pull_request?: unknown;
};

const summarize = (issue: Issue) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  kind: issue.pull_request ? 'pull_request' : 'issue',
  author: issue.user?.login,
  labels: issue.labels?.map(label => label.name),
  comments: issue.comments,
  updated: issue.updated_at,
  url: issue.html_url,
});

export function createGitHubTools(token: string, login: string, allowWrite: boolean): Tool[] {
  const listRepos: Tool = {
    definition: {
      name: 'github_list_repos',
      description: `List the GitHub repositories this connection (${login}) can access.`,
      parameters: { type: 'object', properties: {} },
    },
    async run() {
      const repos = await githubApi<{ full_name: string; private: boolean; description: string | null; default_branch: string }[]>(
        token,
        '/user/repos?per_page=100&sort=updated',
      );
      return JSON.stringify(
        repos.map(repo => ({ repo: repo.full_name, private: repo.private, description: repo.description, defaultBranch: repo.default_branch })),
        null,
        2,
      );
    },
  };

  const listIssues: Tool = {
    definition: {
      name: 'github_list_issues',
      description: 'List issues and pull requests in a repository, most recently updated first.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '"owner/name"' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Default open.' },
          labels: { type: 'string', description: 'Optional comma-separated label names.' },
          since: { type: 'string', description: 'Optional ISO date-time; only items updated after it.' },
        },
        required: ['repo'],
      },
    },
    async run(args) {
      const params = new URLSearchParams({
        state: ['open', 'closed', 'all'].includes(String(args.state)) ? String(args.state) : 'open',
        sort: 'updated',
        per_page: '30',
        ...(args.labels ? { labels: String(args.labels) } : {}),
        ...(args.since ? { since: String(args.since) } : {}),
      });
      const issues = await githubApi<Issue[]>(token, `/repos/${repoOf(args)}/issues?${params}`);
      return issues.length ? JSON.stringify(issues.map(summarize), null, 2) : 'No matching issues or pull requests.';
    },
  };

  const readIssue: Tool = {
    definition: {
      name: 'github_read_issue',
      description: 'Read an issue or pull request with its description and comments. For a pull request it also lists the changed files.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: '"owner/name"' }, number: { type: 'number' } },
        required: ['repo', 'number'],
      },
    },
    async run(args) {
      const repo = repoOf(args);
      const number = numberOf(args);
      const [issue, comments] = await Promise.all([
        githubApi<Issue>(token, `/repos/${repo}/issues/${number}`),
        githubApi<{ user?: { login: string }; created_at: string; body: string }[]>(token, `/repos/${repo}/issues/${number}/comments?per_page=50`),
      ]);
      const sections = [
        JSON.stringify(summarize(issue), null, 2),
        `## Description\n${issue.body || '(none)'}`,
        `## Comments\n${comments.map(c => `- ${c.user?.login} (${c.created_at}): ${c.body}`).join('\n') || '(none)'}`,
      ];
      if (issue.pull_request) {
        const files = await githubApi<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]>(
          token,
          `/repos/${repo}/pulls/${number}/files?per_page=50`,
        );
        sections.push(
          `## Changed files\n${files
            .map(f => `### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${(f.patch ?? '').slice(0, MAX_PATCH_CHARS)}`)
            .join('\n')}`,
        );
      }
      return sections.join('\n\n');
    },
  };

  const readFile: Tool = {
    definition: {
      name: 'github_read_file',
      description: 'Read a file from a repository, or list a directory. Use path "" for the repository root.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '"owner/name"' },
          path: { type: 'string' },
          ref: { type: 'string', description: 'Optional branch, tag or commit. Defaults to the default branch.' },
        },
        required: ['repo', 'path'],
      },
    },
    async run(args) {
      const path = String(args.path ?? '').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
      const ref = args.ref ? `?ref=${encodeURIComponent(String(args.ref))}` : '';
      const content = await githubApi<
        { type: string; name: string; path: string; content?: string; encoding?: string } | { type: string; path: string }[]
      >(token, `/repos/${repoOf(args)}/contents/${path}${ref}`);

      if (Array.isArray(content)) return content.map(entry => `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}`).join('\n');
      if (content.type !== 'file' || content.encoding !== 'base64' || content.content === undefined) {
        return `${content.path} is a ${content.type} and can't be shown as text.`;
      }
      let text = Buffer.from(content.content, 'base64').toString('utf8');
      if (text.length > MAX_FILE_CHARS) text = `${text.slice(0, MAX_FILE_CHARS)}\n...[truncated]`;
      return `# ${content.path}\n\n${text}`;
    },
  };

  const createIssue: Tool = {
    definition: {
      name: 'github_create_issue',
      description: 'Open a new issue in a repository.',
      parameters: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: '"owner/name"' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['repo', 'title'],
      },
    },
    async run(args) {
      const issue = await githubApi<Issue>(token, `/repos/${repoOf(args)}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: String(args.title ?? ''),
          body: String(args.body ?? ''),
          ...(Array.isArray(args.labels) ? { labels: args.labels.map(String) } : {}),
        }),
      });
      return `Opened issue #${issue.number}: ${issue.html_url}`;
    },
  };

  const comment: Tool = {
    definition: {
      name: 'github_comment',
      description: 'Add a comment to an issue or pull request.',
      parameters: {
        type: 'object',
        properties: { repo: { type: 'string', description: '"owner/name"' }, number: { type: 'number' }, body: { type: 'string' } },
        required: ['repo', 'number', 'body'],
      },
    },
    async run(args) {
      const result = await githubApi<{ html_url: string }>(token, `/repos/${repoOf(args)}/issues/${numberOf(args)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: String(args.body ?? '') }),
      });
      return `Commented: ${result.html_url}`;
    },
  };

  const read = [listRepos, listIssues, readIssue, readFile];
  return allowWrite ? [...read, createIssue, comment] : read;
}
