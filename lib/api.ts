import https from 'https';
import { createHash } from 'crypto';

const ENDPOINT = 'https://api.temperatur.nu/tnu_1.20.php';
const TIMEOUT = 15000;
const MAX_BYTES = 256 * 1024;

export interface RequestHandle { cancel?: () => void }
export interface Credentials { clientId: string; clientKey?: string }
export interface Station { id: string; title: string; temp: unknown; lastUpdate?: string }

// Bound the entire request, including the body. Never expose a URL or secret in errors.
export function requestText(url: URL, handle: RequestHandle = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer: NodeJS.Timeout;
    const finish = (error?: Error, body?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      handle.cancel = undefined;
      if (error) reject(error);
      else resolve(body || '');
    };
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        finish(new Error(`Temperature service returned HTTP ${response.statusCode}`));
        response.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          finish(new Error('Temperature service response is too large'));
          response.destroy();
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => finish(undefined, Buffer.concat(chunks).toString('utf8')));
      response.on('error', () => finish(new Error('Temperature service response was interrupted')));
      response.on('aborted', () => finish(new Error('Temperature service response was interrupted')));
    });
    request.on('error', () => finish(new Error('Could not reach temperature service')));
    handle.cancel = () => {
      finish(new Error('Temperature request cancelled'));
      request.destroy();
    };
    timer = setTimeout(() => {
      finish(new Error('Temperature service timed out'));
      request.destroy();
    }, TIMEOUT);
  });
}

export function stationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9_-]+$/i.test(value.trim())) throw new Error('Enter a valid station ID');
  return value.trim().toLowerCase();
}

export function temperatureValue(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim()))) {
    throw new Error('Station has no valid, current temperature');
  }
  const temperature = Number(value);
  if (!Number.isFinite(temperature) || temperature < -100 || temperature > 100) throw new Error('Station has no valid, current temperature');
  return temperature;
}

export function apiUrl(parameters: Record<string, string>, credentials: Credentials): URL {
  const url = new URL(ENDPOINT);
  Object.entries({
    ...parameters, sensor_type: 'air', verbose: '1', cli: credentials.clientId,
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  if (credentials.clientKey) {
    const signature = createHash('md5').update(`${url.host}${url.pathname}${url.search}+${credentials.clientKey}`).digest('hex');
    url.searchParams.set('sign', signature);
  }
  return url;
}

export async function getStations(parameters: Record<string, string>, credentials: Credentials, handle?: RequestHandle): Promise<Station[]> {
  const body = await requestText(apiUrl(parameters, credentials), handle);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Temperature service returned invalid JSON');
  }
  if (!data || data.client === 'blocked') throw new Error('Temperature API limit reached; retrying later');
  if (!['signed', 'unsigned'].includes(data.client) || data.title !== 'Temperatur.nu API 1.20') throw new Error('Unexpected temperature API response');
  if (!Array.isArray(data.stations) || !data.stations.length
      || data.stations.some((station: Station) => !station || typeof station.id !== 'string' || typeof station.title !== 'string')) {
    throw new Error('No matching temperature station found');
  }
  return data.stations;
}

export async function reportTemperature(hash: unknown, value: unknown): Promise<void> {
  if (typeof hash !== 'string' || !/^[a-z0-9]+$/i.test(hash.trim())) throw new Error('Enter a valid station hash');
  const temperature = temperatureValue(value);
  if (temperature < -50) throw new Error('Reported temperature must be between -50 and 100 degrees');
  const url = new URL('https://www.temperatur.nu/rapportera.php');
  url.searchParams.set('hash', hash.trim());
  url.searchParams.set('t', String(temperature));
  const body = await requestText(url);
  if (!/^ok(?:\b|$)/i.test(body.trim())) throw new Error('Temperature report was rejected by the service');
}
