# syntax=docker/dockerfile:1.7

# --- Stage 1: build .NET API ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY src/FreelanceLedger.Api/FreelanceLedger.Api.csproj src/FreelanceLedger.Api/
RUN dotnet restore src/FreelanceLedger.Api/FreelanceLedger.Api.csproj
COPY src/ ./src/
RUN dotnet publish src/FreelanceLedger.Api/FreelanceLedger.Api.csproj -c Release -o /app/publish --no-restore

# --- Stage 2: build frontend ---
FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 3: runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# python3 + WeasyPrint render invoice PDFs in the Consulting Bold house style, so a
# generated invoice matches the ones already sent by hand. The alternative was a
# second container purely to render a one-page PDF.
# The base image is Ubuntu 24.04, where the package is 'weasyprint' and it pulls in
# python3-weasyprint plus the pango/cairo stack. There is no python3-weasyprint to
# install directly.
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl \
      tzdata \
      weasyprint \
      python3-markdown \
      python3-pypdf \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot/
COPY invoice-renderer/ ./invoice-renderer/

# The aspnet image ships an unprivileged user (uid 1654, "app"). The bind mount at /data
# must be owned by that uid on the host: `chown -R 1654:1654 /opt/apps/freelance-ledger`.
# No VOLUME directive: an anonymous volume created when compose forgets the mount is
# exactly the kind of place a database goes to disappear on `compose down -v`.
RUN mkdir -p /data && chown -R app:app /app /data
USER app

EXPOSE 8989
ENV ASPNETCORE_URLS=http://+:8989 \
    ASPNETCORE_ENVIRONMENT=Production \
    TZ=Europe/Oslo \
    ConnectionStrings__DefaultConnection="Data Source=/data/ledger.db"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8989/health || exit 1

ENTRYPOINT ["dotnet", "FreelanceLedger.Api.dll"]
