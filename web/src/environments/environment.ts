type TripMateRuntimeConfig = {
  apiUrl?: string;
};

const runtimeConfig = (globalThis as typeof globalThis & {
  __TRIPMATE_CONFIG__?: TripMateRuntimeConfig;
}).__TRIPMATE_CONFIG__;

const runtimeApiUrl = runtimeConfig?.apiUrl?.trim();

export const environment = {
  production: true,
  // Use a runtime-configured public backend URL when frontend/backend are
  // deployed separately. If omitted, production expects /api/v1 to be
  // reverse-proxied to the TripMate backend on the same public origin.
  apiUrl: runtimeApiUrl || '/api/v1'
};
