// The sign-in settings for this server, read from its environment.

import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { authConfig, settingsFromEnv } from './auth';

export function currentAuth() {
  return authConfig(settingsFromEnv(env), dev);
}
