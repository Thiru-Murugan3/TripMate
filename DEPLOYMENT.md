# TripMate Reachable URL Configuration

TripMate invitation emails must contain a frontend URL that the recipient can actually open.

## Recommended development testing: public HTTPS URL

Run:

    start-public.bat

This is the recommended way to test email invitations with another device or user.

The script:

1. Starts Angular on port 4200.
2. Uses the Angular development proxy so browser API calls to `/api/v1` are forwarded to Spring Boot on `127.0.0.1:8080`.
3. Downloads the official `cloudflared` Windows client into the ignored local `.tools` folder when it is not already present there.
4. Creates a temporary Cloudflare Quick Tunnel such as:

       https://random-name.trycloudflare.com

5. Writes that temporary HTTPS URL into `backend/.env` as `APP_FRONTEND_URL`.
6. Adds the public URL to `APP_CORS_ALLOWED_ORIGINS`.
7. Starts Spring Boot.
8. Keeps the tunnel running while the public-mode window stays open.

New invitation emails will then contain URLs like:

    https://random-name.trycloudflare.com/invite/<secure-token>

The recipient does not need to be on the same Wi-Fi.

Important:

- Send a **new** invitation after `start-public.bat` reports that public mode is ready.
- Keep the `start-public.bat` window open while testing.
- The temporary `trycloudflare.com` URL changes each time the tunnel is restarted.
- Old invitation emails that contain an older temporary URL will stop working after that tunnel is closed.
- Cloudflare Quick Tunnels are for development/testing only. They are not the production deployment.

## Same Wi-Fi / LAN fallback

If you only need another device on the same local network, you can still run:

    start-network.bat

or explicitly provide the correct Wi-Fi/Ethernet IPv4 address:

    start-network.bat 192.168.1.25

LAN mode can fail on corporate Wi-Fi, guest networks, VPNs, client-isolated access points, or restrictive Windows Firewall policies. If that happens, use `start-public.bat` instead.

## Production deployment

For real production users, deploy TripMate to stable HTTPS frontend/backend infrastructure.

Backend example:

    APP_FRONTEND_URL=https://app.example.com
    APP_CORS_ALLOWED_ORIGINS=https://app.example.com

Invitation emails will then contain:

    https://app.example.com/invite/<secure-token>

### Same-origin production deployment

The production Angular build defaults to:

    /api/v1

Configure your reverse proxy or hosting platform so `/api/v1` routes to the Spring Boot backend.

### Separate public backend domain

Edit the deployed `web/public/config.js`:

    window.__TRIPMATE_CONFIG__ = {
      apiUrl: 'https://api.example.com/api/v1'
    };

Then configure the backend:

    APP_FRONTEND_URL=https://app.example.com
    APP_CORS_ALLOWED_ORIGINS=https://app.example.com

Do not include a trailing slash in `APP_FRONTEND_URL`.
