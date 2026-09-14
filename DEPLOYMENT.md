# TripMate Reachable URL Configuration

TripMate invitation emails must contain a frontend URL that the recipient can open. `localhost` is only valid on the same computer that is running Angular.

## Same Wi-Fi / local network testing

On Windows, run:

    start-network.bat

The script:

1. Detects the PC's active LAN IPv4 address.
2. Updates `backend/.env`:
   - `APP_FRONTEND_URL=http://<PC-IP>:4200`
   - `APP_CORS_ALLOWED_ORIGINS=http://localhost:4200,http://<PC-IP>:4200`
3. Starts the Spring Boot backend.
4. Starts Angular on `0.0.0.0:4200`.
5. Prints the URL that another device on the same Wi-Fi can open.

The Angular development build also uses the hostname that opened the page for API calls. For example, opening `http://192.168.1.20:4200` makes the web app call `http://192.168.1.20:8080/api/v1`.

If Windows Firewall prompts for Node.js or Java access, allow **Private networks**.

## Public internet deployment

For people outside your Wi-Fi, TripMate must be deployed to public HTTPS URLs.

Backend environment example:

    APP_FRONTEND_URL=https://app.example.com
    APP_CORS_ALLOWED_ORIGINS=https://app.example.com

Invitation emails will then contain links such as:

    https://app.example.com/invite/<secure-token>

### Frontend and backend on the same public origin

The production Angular build defaults to `/api/v1`. Configure your reverse proxy/platform so `/api/v1` routes to Spring Boot.

### Frontend and backend on different public domains

Edit or generate the deployed `config.js` file:

    window.__TRIPMATE_CONFIG__ = {
      apiUrl: 'https://api.example.com/api/v1'
    };

Then configure the backend:

    APP_FRONTEND_URL=https://app.example.com
    APP_CORS_ALLOWED_ORIGINS=https://app.example.com

Do not include a trailing slash in the public frontend URL.

## Important

A public URL cannot be created by application code alone. A hosting provider, server, tunnel, or domain must actually serve the Angular application at that URL. The repository is now ready for either LAN testing or public deployment without hardcoded localhost URLs.
