# Beszel Dashboard

A fullscreen touchscreen dashboard for monitoring servers via [Beszel](https://beszel.dev). Designed for small landscape displays (480×320) running in Chromium kiosk mode on a Raspberry Pi or Orange Pi.

## Overview

Beszel Dashboard is a lightweight appliance-style web app that:

- Proxies Beszel's PocketBase API so credentials never reach the browser
- Caches device metrics and refreshes every 10 seconds
- Reloads the page every 10 seconds for reliable kiosk updates
- Shows CPU and RAM usage for all devices on a single screen
- Modern card grid layout optimized for small landscape displays

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/MathijsNabbe/PocketBeszel.git
   cd PocketBeszel
   ```

2. Edit `docker-compose.yml` and set your Beszel connection details (see Configuration below).

## Configuration

All settings are configured in `docker-compose.yml` under the `environment` section of the `beszel-dashboard` service:

```yaml
environment:
  PORT: "3000"
  BESZEL_URL: "http://beszel:8090"
  BESZEL_API_KEY: ""
  BESZEL_EMAIL: ""
  BESZEL_PASSWORD: ""
  REFRESH_INTERVAL: "10000"
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Port the dashboard listens on |
| `BESZEL_URL` | Yes | `http://beszel:8090` | Beszel hub URL (use Docker service name when in the same network) |
| `BESZEL_API_KEY` | Yes* | — | PocketBase JWT bearer token |
| `BESZEL_EMAIL` | No | — | Beszel user email (for automatic token refresh) |
| `BESZEL_PASSWORD` | No | — | Beszel user password (for automatic token refresh) |
| `REFRESH_INTERVAL` | No | `10000` | Cache refresh interval in milliseconds |

\* Either `BESZEL_API_KEY` or both `BESZEL_EMAIL` and `BESZEL_PASSWORD` must be set.

### Obtaining a JWT token

Generate a token from your Beszel hub:

```bash
curl -s -X POST "$BESZEL_URL/api/collections/users/auth-with-password" \
  -H "Content-Type: application/json" \
  -d '{"identity":"user@example.com","password":"your-password"}' \
  | jq -r '.token'
```

Paste the result into `BESZEL_API_KEY` in `docker-compose.yml`.

### Automatic token refresh

PocketBase JWT tokens expire. To avoid manual re-authentication, set `BESZEL_EMAIL` and `BESZEL_PASSWORD` in `docker-compose.yml`. The backend will automatically obtain a new token when the current one expires.

## Running

Start the dashboard with Docker Compose:

```bash
docker compose up -d
```

Open `http://localhost:3000` in your browser.

### Connecting to an existing Beszel instance

If Beszel runs in a separate Docker Compose stack, connect both to a shared network:

```yaml
# In your Beszel compose file:
networks:
  beszel:
    name: beszel
```

Then uncomment the `networks` section in this project's `docker-compose.yml` and set `BESZEL_URL` to `http://beszel:8090`.

## Updating

After pulling changes, rebuild and restart:

```bash
git pull
docker compose up -d --build
```

If you changed environment variables in `docker-compose.yml`, recreate the container:

```bash
docker compose up -d --force-recreate
```

## API

The backend exposes two endpoints:

- `GET /api/devices` — Returns an array of `{ id, name, cpu, ram }` objects
- `GET /api/health` — Returns `{ status, beszel, deviceCount, lastUpdated }`

## Kiosk mode (Raspberry Pi / Orange Pi)

Launch Chromium in kiosk mode on your display:

```bash
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3000
```

The page automatically reloads every 10 seconds via a meta refresh tag, which keeps kiosk displays up to date even when JavaScript timers are throttled.

For a 480×320 display, set the framebuffer resolution in `/boot/config.txt` or your display driver configuration.

## Troubleshooting

### "Backend Offline"

The dashboard server is not reachable. Check that the container is running:

```bash
docker compose ps
docker compose logs beszel-dashboard
```

### "Cannot connect to Beszel"

The dashboard is running but cannot reach Beszel. Verify:

- `BESZEL_URL` in `docker-compose.yml` is correct (use the Docker service name, not `localhost`, when both run in Docker)
- Both containers are on the same Docker network
- `BESZEL_API_KEY` is valid, or `BESZEL_EMAIL`/`BESZEL_PASSWORD` are set for auto-refresh
- Beszel is running: `curl http://beszel:8090/api/health`

### "No devices found"

Beszel is reachable but no systems are registered. Add agents via the Beszel web UI at `http://your-beszel-host:8090`.

### Expired JWT token

If using only `BESZEL_API_KEY`, regenerate the token with the curl command above and update `docker-compose.yml`. Alternatively, set `BESZEL_EMAIL` and `BESZEL_PASSWORD` for automatic refresh.

## License

GPL-3.0 — see [LICENSE](LICENSE).
