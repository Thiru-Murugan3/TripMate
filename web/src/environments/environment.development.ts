const browserHostname =
  typeof window !== 'undefined' && window.location.hostname
    ? window.location.hostname
    : 'localhost';

export const environment = {
  production: false,
  // localhost when opened locally, or the PC's LAN IP when another device
  // opens Angular through http://<PC-IP>:4200.
  apiUrl: `http://${browserHostname}:8080/api/v1`
};
