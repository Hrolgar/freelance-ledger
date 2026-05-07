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
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot/

EXPOSE 8989
VOLUME ["/data"]
ENV ASPNETCORE_URLS=http://+:8989 \
    ASPNETCORE_ENVIRONMENT=Production \
    ConnectionStrings__DefaultConnection="Data Source=/data/ledger.db"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://localhost:8989/health || exit 1

ENTRYPOINT ["dotnet", "FreelanceLedger.Api.dll"]
