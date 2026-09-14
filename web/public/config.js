// TripMate runtime deployment configuration.
//
// Local development can leave apiUrl empty. The development Angular build
// automatically uses the hostname that opened the page with backend port 8080.
//
// Production options:
// 1. Same-origin reverse proxy: leave apiUrl empty and proxy /api/v1 to backend.
// 2. Separate backend domain: set the full public API URL below.
window.__TRIPMATE_CONFIG__ = {
  apiUrl: ''
};
