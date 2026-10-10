# Deployment

Netlify and Cloudflare Pages are supported static hosts. Use [PRODUCTION.md](PRODUCTION.md) for complete deployment steps and every supported public build variable. Root netlify.toml supplies the Netlify build, publish directory, Node version and SPA rewrite. public/_headers supplies cache/security headers.

No deployment was performed by these code changes. Verify HTTPS, direct-route refresh, service-worker activation and a cold offline scan on the deployed origin. Export/import browser data when moving origins.
