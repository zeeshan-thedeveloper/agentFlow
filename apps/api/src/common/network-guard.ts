import { lookup, promises as dns, type LookupAddress, type LookupOptions } from 'dns';
import { BlockList, isIP } from 'net';
import { networkInterfaces } from 'os';
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit, type Response as UndiciResponse } from 'undici';

// Agents fetch URLs and open database connections that users (or text the agent
// read) choose. The API runs on the host network, so without this an agent
// could reach the server itself, other services on it, or the cloud metadata
// endpoint. Every outbound request from a tool or a user database goes through
// here and is refused when the address is private, reserved, or the server's own.

const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}
// The server's own addresses, including its public IP on the host network.
for (const addresses of Object.values(networkInterfaces())) {
  for (const { address, family } of addresses ?? []) blocked.addAddress(address, family === 'IPv6' ? 'ipv6' : 'ipv4');
}

/** An IPv4 address hidden inside an IPv6 one (::ffff:1.2.3.4, ::ffff:102:304, 64:ff9b::1.2.3.4), if any. */
function embeddedIPv4(address: string): string | null {
  const match = /^(?:::ffff:|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(address);
  if (!match) return null;
  if (match[1]) return match[1];
  const high = parseInt(match[2], 16);
  const low = parseInt(match[3], 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join('.');
}

export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const v4 = embeddedIPv4(bare);
  if (v4) return blocked.check(v4, 'ipv4');
  const family = isIP(bare);
  if (family === 0) return true;
  return blocked.check(bare, family === 6 ? 'ipv6' : 'ipv4');
}

/** Local development can opt in to reaching localhost services; production never can. */
function privateNetworkAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_PRIVATE_NETWORK === 'true';
}

export class BlockedAddressError extends Error {
  constructor(host: string) {
    super(`"${host}" points to a private or internal network address, which AgentFlow can't connect to.`);
  }
}

/** Resolves `host` and throws if it, or any address it resolves to, is private or internal. */
export async function assertPublicHost(host: string): Promise<void> {
  if (privateNetworkAllowed()) return;
  const bare = host.replace(/^\[|\]$/g, '');
  if (!bare || bare.toLowerCase() === 'localhost' || bare.toLowerCase().endsWith('.localhost')) {
    throw new BlockedAddressError(host);
  }
  if (isIP(bare.split('%')[0])) {
    if (isBlockedAddress(bare)) throw new BlockedAddressError(host);
    return;
  }
  const addresses = await dns.lookup(bare, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new BlockedAddressError(host);
  }
}

/**
 * Checks addresses again at connect time, so a hostname that resolved to a
 * public address during assertPublicHost can't switch to a private one when
 * the connection is made (DNS rebinding).
 */
function guardedLookup(
  hostname: string,
  options: LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
  lookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '');
    if (!privateNetworkAllowed() && (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address)))) {
      return callback(Object.assign(new BlockedAddressError(hostname), { code: 'EBLOCKED' }), '');
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const guardedAgent = new Agent({ connect: { lookup: guardedLookup as never } });
const MAX_REDIRECTS = 5;

export type SafeFetchInit = Pick<UndiciRequestInit, 'method' | 'headers' | 'body'> & { timeoutMs?: number };

/** fetch() for URLs an agent chooses: http(s) only, public addresses only, each redirect checked. */
export async function safeFetch(input: string, init: SafeFetchInit = {}): Promise<UndiciResponse> {
  let url = new URL(input);
  let { method = 'GET', body } = init;
  const signal = AbortSignal.timeout(init.timeoutMs ?? 15_000);

  for (let redirects = 0; ; redirects++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http:// and https:// URLs are allowed.');
    await assertPublicHost(url.hostname);

    const response = await undiciFetch(url, { method, headers: init.headers, body, redirect: 'manual', signal, dispatcher: guardedAgent });
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return response;

    await response.body?.cancel();
    if (redirects >= MAX_REDIRECTS) throw new Error('Too many redirects.');
    url = new URL(location, url);
    // Like browsers: 303, and 301/302 after a POST, continue as a GET without a body.
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
      method = 'GET';
      body = undefined;
    }
  }
}

/** The hosts a postgres:// or mongodb:// connection string would connect to. */
function connectionHosts(connectionString: string): string[] {
  const match = /^([a-z+]+):\/\/(?:[^@/?#]*@)?([^/?#]*)/i.exec(connectionString.trim());
  if (!match) throw new Error('Use a connection URL like postgresql://user:password@host:5432/database.');
  const hosts = match[2]
    .split(',')
    .map(entry => (entry.startsWith('[') ? entry.slice(0, entry.indexOf(']') + 1) : entry.split(':')[0]))
    .filter(Boolean);
  // libpq-style ?host= overrides the host in the URL, and can point at a local socket.
  const query = connectionString.includes('?') ? new URLSearchParams(connectionString.split('?')[1]) : null;
  for (const host of [...(query?.getAll('host') ?? []), ...(query?.getAll('hostaddr') ?? [])]) {
    hosts.push(...host.split(','));
  }
  return hosts.map(decodeURIComponent);
}

/** Refuses database connection strings that point at private or internal hosts. */
export async function assertPublicDatabase(connectionString: string): Promise<void> {
  if (privateNetworkAllowed()) return;
  const scheme = connectionString.trim().split(':')[0].toLowerCase();
  const hosts = connectionHosts(connectionString);
  if (hosts.length === 0) throw new Error('The connection string has no host.');
  if (hosts.some(host => host.startsWith('/'))) throw new BlockedAddressError(hosts.find(host => host.startsWith('/'))!);

  if (scheme === 'mongodb+srv') {
    // The SRV record decides which servers the driver actually connects to.
    const records = await dns.resolveSrv(`_mongodb._tcp.${hosts[0]}`);
    await Promise.all(records.map(record => assertPublicHost(record.name)));
    return;
  }
  await Promise.all(hosts.map(assertPublicHost));
}
