# Freelance Ledger

Web app for tracking freelance finances — projects, milestones, costs, and monthly P&L.

## Deployment

Pull and run the image from GHCR:

```bash
docker run -d \
  --name freelance-ledger \
  -p 8989:8989 \
  -v ledger-data:/data \
  --restart unless-stopped \
  ghcr.io/hrolgar/freelance-ledger:latest
```

Then visit `http://<host>:8989`. The SQLite DB lives at `/data/ledger.db` inside the container. To migrate an existing DB, copy it onto the host volume:

```bash
docker cp ledger.db freelance-ledger:/data/ledger.db
docker restart freelance-ledger
```

The app will run pending migrations on startup; existing data is preserved.
