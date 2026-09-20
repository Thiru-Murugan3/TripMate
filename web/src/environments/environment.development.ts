export const environment = {
  production: false,
  // Development uses the Angular dev-server proxy. Browser requests stay on
  // the same origin (localhost, LAN, or a public tunnel) and Angular forwards
  // /api requests to Spring Boot on 127.0.0.1:8080. The local backend reads
  // the shared TiDB credentials from its ignored backend/.env file.
  apiUrl: '/api/v1'
};
