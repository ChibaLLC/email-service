# Stalwart Setup

This guide covers the Stalwart-specific setup for this repo: running the production-oriented Stalwart stack from the consolidated production compose file, using it from the app through the existing nodemailer provider, and combining it with Postal when needed.

## What This Repo Provides

- A production Stalwart compose definition in [docker-compose.stalwart.yml](../../docker-compose.stalwart.yml)
- A consolidated production compose file in [docker-compose.prod.yml](../../docker-compose.prod.yml) that includes the base app services plus Stalwart, Postal, and Listmonk
- A Stalwart config generator in [scripts/stalwart/config.mjs](../../scripts/stalwart/config.mjs) and [scripts/stalwart/init.mjs](../../scripts/stalwart/init.mjs)
- A helper cleanup script in [scripts/stalwart/free-ports.sh](../../scripts/stalwart/free-ports.sh) for freeing the standard Stalwart mail ports on a server before startup
- App integration through the existing nodemailer provider in [server/email/providers/nodemailer.ts](../../server/email/providers/nodemailer.ts)

## Quick Start

### 1. Start the production stack

```bash
docker compose -f ./docker-compose.prod.yml --env-file .env up
```

This starts the full production stack, including:

- the app
- Postal
- Listmonk
- Stalwart
- dedicated PostgreSQL for Stalwart metadata and internal directory state
- dedicated Redis for lookup and in-memory state
- dedicated MinIO for blob/object storage
- one-shot init services that create the MinIO bucket and write the Stalwart `config.toml`

The Stalwart services publish the standard mail ports directly on the host: `25`, `587`, `465`, `143`, `993`, `110`, `995`, and `4190`.

If you prefer detached startup, use `docker compose -f ./docker-compose.prod.yml --env-file .env up -d`.

If startup fails because one of the Stalwart mail ports is already in use on the host, there is a helpful script you can run on the server before retrying:

```bash
sudo ./scripts/stalwart/free-ports.sh
```

That script stops common Linux mail services, stops Docker containers already publishing the Stalwart mail ports, and kills any remaining listeners on ports `25`, `110`, `143`, `465`, `587`, `993`, `995`, and `4190`.

## First Login

This repo now configures a deterministic fallback admin user in the generated Stalwart config.

Set these values in `.env` before first startup:

```bash
STALWART_ADMIN_USER=admin
STALWART_ADMIN_PASSWORD=change-this-password
```

The same keys are documented in [../../.env.example](../../.env.example).

Use those credentials to sign in to the Stalwart web UI.

If you are trying to access the web UI from outside Docker, you need one of these setups:

- publish `8080` or `443` from the `stalwart` service to the host
- route a public hostname to the internal Stalwart web port through your reverse proxy

## Using Stalwart With Postal

Stalwart can run in the same deployment as Postal because [docker-compose.prod.yml](../../docker-compose.prod.yml) includes both sets of services.

Typical split:

- Use Postal for transactional or API-driven sending.
- Use Stalwart for employee mailboxes, IMAP/POP/JMAP access, or authenticated SMTP submission.

The app only sends through one configured provider at a time. If you want the app to send through Stalwart, use the nodemailer settings shown below. If you want the app to send through Postal instead, switch back to the Postal provider env configuration documented in [docs/postal/README.md](../postal/README.md).

Important for inbound delivery: if Stalwart should receive mail for a domain, do not keep Postal MX records for that same domain. Remove the Postal MX targets and keep only the Stalwart MX target, for example keep `example.com MX 10 stalwart.example.com` and remove `mx1.postal.example.com` and `mx2.postal.example.com`. Otherwise remote senders may choose either system for delivery.

## Configure Stalwart In Production

The production overlay writes a `config.toml` that preselects these backends from first boot:

- data store: PostgreSQL
- search store: PostgreSQL
- blob store: MinIO (S3-compatible)
- lookup/in-memory store: Redis
- directory: internal directory backed by PostgreSQL

That avoids the "boot with RocksDB first, migrate later" problem.

After first login:

1. Open the Stalwart web admin.
2. Go to `Settings` > `Server` > `Network` and set the real server hostname.
3. Go to `Management` > `Directory` > `Domains` and add your mail domain.
4. Copy the DNS records Stalwart generates and publish them at your DNS provider.
5. Go to `Management` > `Directory` > `Accounts` and create the mailboxes or SMTP accounts you need.
6. If needed, configure TLS in Stalwart or terminate TLS in your reverse proxy.
7. Create the user accounts or mailboxes you want your team to use.

Stalwart generates its own recommended DNS records per configured domain, including SPF, DKIM, DMARC, and optional autoconfig/SRV guidance.

Important production env keys in [.env.example](../../.env.example):

- `STALWART_HOSTNAME`
- `STALWART_AUTODISCOVER_HOSTNAME`
- `STALWART_AUTOCONFIG_HOSTNAME`
- `STALWART_MTA_STS_HOSTNAME`
- `STALWART_ADMIN_USER`
- `STALWART_ADMIN_PASSWORD`
- `STALWART_ACME_ENABLED`
- `STALWART_ACME_DIRECTORY`
- `STALWART_ACME_CHALLENGE`
- `STALWART_ACME_CONTACT`
- `STALWART_ACME_DOMAINS`
- `STALWART_ACME_CACHE`
- `STALWART_ACME_RENEW_BEFORE`
- `STALWART_ACME_DEFAULT`
- `STALWART_PROXY_TRUSTED_NETWORKS`
- `STALWART_PROXY_AUTODETECT`
- `STALWART_DOCKER_SOCKET_PATH`
- `STALWART_HTTP_USE_X_FORWARDED`
- `STALWART_TRAEFIK_ENABLED`
- `STALWART_TRAEFIK_DOCKER_NETWORK`
- `STALWART_TRAEFIK_HTTPS_ENTRYPOINT`
- `STALWART_TRAEFIK_SMTP_ENTRYPOINT`
- `STALWART_TRAEFIK_SMTPS_ENTRYPOINT`
- `STALWART_TRAEFIK_IMAPS_ENTRYPOINT`
- `STALWART_DB_USER`
- `STALWART_DB_PASSWORD`
- `STALWART_DB_NAME`
- `STALWART_REDIS_PASSWORD`
- `STALWART_MINIO_ROOT_USER`
- `STALWART_MINIO_ROOT_PASSWORD`
- `STALWART_MINIO_BUCKET`
- `STALWART_MINIO_REGION`

## Automatic TLS With ACME

The generated Stalwart config can now emit an optional Let's Encrypt ACME section.

Set these values in `.env` to enable it:

```bash
STALWART_ACME_ENABLED=true
STALWART_ACME_DIRECTORY=https://acme-v02.api.letsencrypt.org/directory
STALWART_ACME_CHALLENGE=tls-alpn-01
STALWART_ACME_CONTACT=postmaster@example.com
STALWART_ACME_DOMAINS=stalwart.example.com
STALWART_ACME_CACHE=%{BASE_PATH}%/etc/acme
STALWART_ACME_RENEW_BEFORE=30d
STALWART_ACME_DEFAULT=true
```

Important constraint: `tls-alpn-01` only works if Stalwart itself can answer the ACME challenge on port `443` for the names in `STALWART_ACME_DOMAINS`.

In this repo, the `stalwart` service currently publishes the mail ports directly but does not publish `443`. If Traefik or Dokploy already terminates HTTPS for that hostname, Stalwart will not receive the `tls-alpn-01` challenge unless you explicitly route or pass through port `443` to Stalwart.

For a reverse-proxy-managed deployment, use one of these models:

1. Let Stalwart manage its own certificates and make `443` reach Stalwart for ACME validation.
2. Keep web TLS in Traefik and switch Stalwart ACME to `dns-01` instead of `tls-alpn-01`.

This repo currently generates the common ACME settings shown in the Stalwart Let's Encrypt example: directory, challenge, contact, domains, cache, renew-before, and default. If you want `dns-01`, you will also need to extend the generator with your provider-specific Stalwart settings such as `provider`, `secret`, `origin`, or RFC2136 parameters.

Enabling ACME here is the right fix for the SMTP certificate problem you observed, because the current Stalwart config enables TLS listeners but does not define any certificate source. Without ACME or an explicit certificate configuration, Stalwart falls back to a self-signed certificate.

## Reverse Proxy Examples

The generated `config.toml` comes from [scripts/stalwart/config.mjs](../../scripts/stalwart/config.mjs) through [scripts/stalwart/init.mjs](../../scripts/stalwart/init.mjs). That script is what defines the internal Stalwart listeners your reverse proxy targets: SMTP on `25`, submission on `587`, SMTPS on `465`, IMAPS on `993`, HTTP on `8080`, and HTTPS or JMAP on `443`.

That same generator now also supports reverse-proxy-aware settings:

- `STALWART_PROXY_TRUSTED_NETWORKS` writes per-listener Proxy Protocol trust settings for SMTP, SMTPS, IMAPS, and HTTPS.
- `STALWART_HTTP_USE_X_FORWARDED=true` makes the generated config trust forwarded HTTP headers for the web UI.

To avoid looking up the proxy subnet manually, this repo also includes [scripts/stalwart/proxy-network.mjs](../../scripts/stalwart/proxy-network.mjs). It inspects the Docker network used by Traefik and prints the value for `STALWART_PROXY_TRUSTED_NETWORKS`.

If you prefer to resolve this automatically during Stalwart config generation, set `STALWART_PROXY_AUTODETECT=true`. The one-shot `stalwart-config` container will inspect the Docker API through `/var/run/docker.sock` and populate `STALWART_PROXY_TRUSTED_NETWORKS` before [scripts/stalwart/config.mjs](../../scripts/stalwart/config.mjs) writes `config.toml`.

The compose overlay now includes optional Traefik labels on the `stalwart` service. They stay inactive unless you set `STALWART_TRAEFIK_ENABLED=true`.

By default, the Traefik network label is derived from `COMPOSE_PROJECT_NAME` as `${COMPOSE_PROJECT_NAME}_default`. If Traefik runs on a different project-prefixed or external Docker network, set `STALWART_TRAEFIK_DOCKER_NETWORK` to the exact shared network name. This value is written directly to the `traefik.docker.network` label so Traefik selects the correct network for the container.

Example `.env` values for Traefik:

```bash
STALWART_TRAEFIK_ENABLED=true
COMPOSE_PROJECT_NAME=mailstack
STALWART_HOSTNAME=mail.example.com
STALWART_AUTODISCOVER_HOSTNAME=autodiscover.example.com
STALWART_AUTOCONFIG_HOSTNAME=autoconfig.example.com
STALWART_MTA_STS_HOSTNAME=mta-sts.example.com
STALWART_TRAEFIK_HTTPS_ENTRYPOINT=https
STALWART_TRAEFIK_SMTP_ENTRYPOINT=smtp
STALWART_TRAEFIK_SMTPS_ENTRYPOINT=smtps
STALWART_TRAEFIK_IMAPS_ENTRYPOINT=imaps
STALWART_PROXY_AUTODETECT=true
STALWART_HTTP_USE_X_FORWARDED=true
```

You can generate that value automatically:

```bash
pnpm stalwart:proxy-network
```

By default the helper inspects `${STALWART_TRAEFIK_DOCKER_NETWORK}` when it is set, otherwise `${COMPOSE_PROJECT_NAME}_default`.

Useful variants:

```bash
pnpm stalwart:proxy-network --format value
pnpm stalwart:proxy-network --network traefik_proxy
pnpm stalwart:proxy-network --env-file .env
```

The `--env-file .env` form updates `STALWART_PROXY_TRUSTED_NETWORKS` in your env file directly.

Auto-detect tradeoff:

1. `STALWART_PROXY_AUTODETECT=true` is convenient, but it requires mounting the Docker socket into the `stalwart-config` container.
2. That socket effectively gives the container privileged access to Docker on the host, so use this only when you accept that security tradeoff.
3. If you want the safer path, leave autodetect off and keep using `pnpm stalwart:proxy-network --env-file .env` before startup.

Traefik:

```yaml
services:
  stalwart:
	labels:
	  - traefik.enable=true
	  - traefik.docker.network=mailstack_default
	  - traefik.http.routers.mailserver.rule=Host(`mail.example.com`) || Host(`autodiscover.example.com`) || Host(`autoconfig.example.com`) || Host(`mta-sts.example.com`)
	  - traefik.http.routers.mailserver.entrypoints=https
	  - traefik.http.routers.mailserver.service=mailserver
	  - traefik.http.services.mailserver.loadbalancer.server.port=8080
	  - traefik.tcp.routers.smtp.rule=HostSNI(`*`)
	  - traefik.tcp.routers.smtp.entrypoints=smtp
	  - traefik.tcp.routers.smtp.service=smtp
	  - traefik.tcp.services.smtp.loadbalancer.server.port=25
	  - traefik.tcp.services.smtp.loadbalancer.proxyProtocol.version=2
	  - traefik.tcp.routers.jmap.rule=HostSNI(`*`)
	  - traefik.tcp.routers.jmap.tls.passthrough=true
	  - traefik.tcp.routers.jmap.entrypoints=https
	  - traefik.tcp.routers.jmap.service=jmap
	  - traefik.tcp.services.jmap.loadbalancer.server.port=443
	  - traefik.tcp.services.jmap.loadbalancer.proxyProtocol.version=2
	  - traefik.tcp.routers.smtps.rule=HostSNI(`*`)
	  - traefik.tcp.routers.smtps.tls.passthrough=true
	  - traefik.tcp.routers.smtps.entrypoints=smtps
	  - traefik.tcp.routers.smtps.service=smtps
	  - traefik.tcp.services.smtps.loadbalancer.server.port=465
	  - traefik.tcp.services.smtps.loadbalancer.proxyProtocol.version=2
	  - traefik.tcp.routers.imaps.rule=HostSNI(`*`)
	  - traefik.tcp.routers.imaps.tls.passthrough=true
	  - traefik.tcp.routers.imaps.entrypoints=imaps
	  - traefik.tcp.routers.imaps.service=imaps
	  - traefik.tcp.services.imaps.loadbalancer.server.port=993
	  - traefik.tcp.services.imaps.loadbalancer.proxyProtocol.version=2
```

Caddy:

```caddy
mail.example.com {
	reverse_proxy http://stalwart:8080
}

{
	layer4 {
		0.0.0.0:25 {
			route {
				proxy {
					proxy_protocol v2
					upstream stalwart:25
				}
			}
		}
		0.0.0.0:465 {
			route {
				proxy {
					proxy_protocol v2
					upstream stalwart:465
				}
			}
		}
		0.0.0.0:993 {
			route {
				proxy {
					proxy_protocol v2
					upstream stalwart:993
				}
			}
		}
	}
}
```

NGINX:

```nginx
stream {
	server {
		listen 25 proxy_protocol;
		proxy_pass stalwart:25;
		proxy_protocol on;
	}

	server {
		listen 465 proxy_protocol;
		proxy_pass stalwart:465;
		proxy_protocol on;
	}

	server {
		listen 993 proxy_protocol;
		proxy_pass stalwart:993;
		proxy_protocol on;
	}
}

http {
	server {
		listen 443 ssl;
		server_name mail.example.com autodiscover.example.com autoconfig.example.com mta-sts.example.com;

		location / {
			proxy_pass http://stalwart:8080;
			proxy_set_header Host $host;
			proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
			proxy_set_header X-Forwarded-Proto $scheme;
		}
	}
}
```

Operational notes:

1. If Traefik, Caddy, or NGINX owns host ports `25`, `443`, `465`, or `993`, do not also publish those same host ports directly from the `stalwart` container in that deployment. Use a compose override or deployment-specific compose file to avoid port conflicts.
2. For project-based Compose deployments with Traefik, the default network label becomes `${COMPOSE_PROJECT_NAME}_default`. If Traefik uses a different shared network, override it with `STALWART_TRAEFIK_DOCKER_NETWORK`.
3. For Traefik, Caddy, or NGINX TCP forwarding with Proxy Protocol enabled, set `STALWART_PROXY_TRUSTED_NETWORKS` to the proxy container IPs or CIDRs. Without that, Stalwart will not have the right client connection metadata.
4. For HTTP reverse proxying of the web UI, set `STALWART_HTTP_USE_X_FORWARDED=true` so the generated config in [scripts/stalwart/config.mjs](../../scripts/stalwart/config.mjs) trusts forwarded scheme and address headers.
5. For Traefik TCP passthrough on `443`, `465`, and `993`, Stalwart still needs a valid certificate source. That means ACME in [scripts/stalwart/config.mjs](../../scripts/stalwart/config.mjs) or explicit certificate settings added to that generator.
6. Caddy needs layer 4 support for raw mail protocols. Without `caddy-l4` or another L4-capable proxy in front, it can only cover the web UI.

## Configure The App To Use Stalwart

The app does not need a new provider for Stalwart. Use the existing nodemailer provider.

For the consolidated production stack, set `.env` like this when the app should send through Stalwart:

```bash
EMAIL_PROVIDER=nodemailer
SMTP_HOST=stalwart
SMTP_PORT=587
SMTP_USER=your-stalwart-account@example.com
SMTP_PASS=your-stalwart-password
DEFAULT_FROM=your-stalwart-account@example.com
```

Because [server/email/providers/nodemailer.ts](../../server/email/providers/nodemailer.ts) treats port `465` as implicit TLS and all other ports as non-implicit TLS, `587` is the safest default for authenticated submission.

## Notes

- Stalwart is a full mail stack with mailbox protocols such as IMAP, POP3, SMTP, and JMAP
- Unlike Postal, it is suitable for employee mailboxes as well as SMTP relay
- Mail-related DNS records and hostnames should be `DNS only`, not proxied through Cloudflare
- Keep exactly one SPF record per domain

## Official Stalwart References

- Overview: `https://stalw.art/`
- Docker install: `https://stalw.art/docs/install/platform/docker`
- DNS setup: `https://stalw.art/docs/install/dns`
