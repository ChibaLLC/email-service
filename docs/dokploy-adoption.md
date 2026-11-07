# Manage an existing mail installation in Dokploy

Use `docker-compose.dokploy.yml` to adopt an **already initialized** installation.
It includes the app, its PostgreSQL/Redis services, Stalwart, its PostgreSQL/Redis
services, Garage, and Bulwark. It does not bootstrap Stalwart/Garage or start
optional applications. Use the normal production setup for a fresh installation.

1. Back up databases, configuration, Garage metadata, and mail blobs first.
2. Create a Git-backed Compose service pointing to this repository and set its
   Compose path to `./docker-compose.dokploy.yml`.
3. Preserve the existing Docker Compose project name when adopting containers.
   Check the actual app name in Dokploy; it may append a generated suffix.
4. Copy the existing private environment into Dokploy's Environment settings and
   enable creation of the `.env` file. Never commit that environment to Git.
5. Set `MAIL_VOLUME_PREFIX` and `MAIL_DOCKER_NETWORK` to the existing resources.
   Defaults are `email-service` and `email-service_default`. External volumes
   deliberately make deployment fail if existing data is missing.
6. Preserve existing image versions with `STALWART_IMAGE`, `GARAGE_IMAGE`, and
   `BULWARK_IMAGE` when adopting; this operation should not also upgrade servers.
7. Validate the resolved Compose configuration against the current containers:
   volume names, networks, mail ports, hostnames, database credentials, and SMTP
   destination. Registering a service does not require redeploying live mail.

Keep Git automatic deployment off until the first deployment has been reviewed.
Dokploy can build the app from the repository on a later manual deployment.
Its default deployment command includes `--build`; use an explicit Compose
command with `--no-build` when reusing the installed app image on a small VPS.

All data volumes and both networks are external. Stop/redeploy operations must
retain them. Do not use fresh-volume deployment, `down -v`, or volume pruning.
The existing certificate-sync job may remain in place: preserve its paths and
the Compose project name, or update the job before removing old deployment files.
