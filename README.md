# Freelance Ledger

Web app for tracking freelance finances — projects, milestones, costs, and monthly P&L.

## Deployment

The image is built by GitHub Actions on every push to main (tests and the frontend
typecheck must pass first) and published as `ghcr.io/hrolgar/freelance-ledger:latest`.

The app has no login of its own. It expects to sit behind a reverse proxy that runs
Authentik forward-auth on `/api`, `/scalar` and `/openapi` and forwards the
`X-authentik-username` header; requests on those paths without that header get a 401.
Do not publish the container port on the host: put the container on the proxy's Docker
network and let the proxy reach it by service name. For a local run without a proxy set
`Ledger__RequireAuthHeader=false`.

The container runs as the unprivileged `app` user (uid 1654). The data directory on the
host must be owned by that uid:

```bash
sudo mkdir -p /opt/apps/freelance-ledger && sudo chown -R 1654:1654 /opt/apps/freelance-ledger
```

Compose service, minimal:

```yaml
  freelance-ledger:
    image: ghcr.io/hrolgar/freelance-ledger:latest
    restart: unless-stopped
    volumes:
      - /opt/apps/freelance-ledger:/data
    networks:
      - proxy
```

The SQLite database lives at `/data/ledger.db`, uploads under `/data/files`, and the app's
own backups under `/data/backups`. Migrations run at startup; when there is one pending,
a verified backup (`ledger-<stamp>-premigrate.db`) is written first and the boot refuses
to continue if that backup cannot be taken.

## Backups and restore

The app writes a WAL-consistent backup nightly and before every migration, keeps 14 days
or 30 files, whichever is smaller, and runs `PRAGMA integrity_check` on each copy. Those
copies are on the same disk as the live database. Back up `/opt/apps/freelance-ledger`
(database, backups AND `files/`) off the box with the host's own backup job.

The database runs in WAL mode, so a restore is never "copy ledger.db over the old one":
a stale `ledger.db-wal` next to the new file would be replayed into it.

```bash
cd /opt/stacks/apps
docker compose stop freelance-ledger
sudo rm -f /opt/apps/freelance-ledger/ledger.db-wal /opt/apps/freelance-ledger/ledger.db-shm
sudo cp /opt/apps/freelance-ledger/backups/ledger-<stamp>.db /opt/apps/freelance-ledger/ledger.db
sudo chown 1654:1654 /opt/apps/freelance-ledger/ledger.db
docker compose start freelance-ledger
```

To inspect the live database without stopping the container, use the backup API from
inside it rather than copying the file (a copy misses the WAL):

```bash
docker exec -i freelance-ledger python3 - <<'EOF'
import sqlite3
sqlite3.connect('/data/ledger.db').backup(sqlite3.connect('/tmp/copy.db'))
EOF
docker cp freelance-ledger:/tmp/copy.db ./ledger-copy.db
```
