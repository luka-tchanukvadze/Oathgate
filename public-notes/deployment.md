# Deployment

[Back to the README](../README.md)

It runs on a Raspberry Pi. Push to `master`, and about six minutes later the new
version is live without anybody logging into anything.

## One image, three containers

The api, the worker and notifications are the **same build started three
different ways**.

```dockerfile
CMD ["node", "dist/apps/api/src/main"]   # compose overrides this for the other two
```

Three Dockerfiles would have produced three images that were almost entirely
identical layers, and the machine would pull all three. One image is pulled
once.

The build is three stages:

| Stage | Does |
| --- | --- |
| `deps` | Copies only the lockfile and runs `npm ci`, so the layer is reused until a dependency actually changes |
| `build` | Generates both Prisma clients, compiles, then `npm prune --omit=dev` |
| `runtime` | Copies the pruned `node_modules` and `dist` into a clean base |

The runtime image has no compiler, no test runner and no build tools, because
they never enter it rather than because they were removed.

Alpine is safe here despite the usual musl warning, because the only native
dependency is argon2 and it ships a prebuilt musl binary for armv8.

### Three things the prune took that the container needed

Each one was a separate failure, found one at a time, on the machine.

`prisma` is the migration CLI and the container runs migrations.
`dotenv` is imported by the Prisma config file.
`tsx` is what runs the seed.

All three were `devDependencies`. They are ordinary dependencies now, and the
CI pipeline proves it by running `prisma migrate deploy --help` inside the built
image before pushing it. If the prune ever takes the CLI again, the pipeline
fails instead of the deployment.

### And one thing the image was missing

The seed is the only file that runs **from source** rather than from `dist`,
because Prisma invokes it with `tsx`. It imports the generated client by
relative path, and the runtime image shipped `dist` only.

One `COPY` line and a megabyte of generated code fixed it. Without the seed
there is no merchant and no house accounts, so nothing can settle at all.

## Migrations run once, in their own container

```yaml
migrate:
  command: >
    sh -c "npx prisma migrate deploy &&
           npx prisma migrate deploy --config apps/notifications/prisma.config.ts"

api:
  depends_on:
    migrate:
      condition: service_completed_successfully
```

Three containers each migrating on boot would have three processes racing the
same tables. Worse, a failed migration would leave a half-started system rather
than stopping the deployment.

`service_completed_successfully` means the three apps do not start until the
migration container has exited zero.

Two `migrate deploy` calls because notifications owns its own database and its
own schema. Paths inside a Prisma config are relative to that config, not to the
working directory, which is easy to get wrong once.

## The pipeline

```
push to master
  |
  +-- test      real Postgres, real Redis, lint, build, e2e
  |
  +-- publish   build on native arm64, prove the image can migrate, push to GHCR
                (only runs if test passed)
```

Nothing reaches the machine unless the tests pass.

**The build runs on a native arm64 runner.** GitHub provides them now. The same
build emulated with QEMU on an x86 runner took about five times as long: ten
minutes down to two.

**Frontend-only commits do not rebuild the image.** The workflow filters on
paths. A change to the dashboard cannot change the backend image, so it should
not spend six minutes producing an identical one.

**The test job runs Node 24, the image runs Node 22.** Jest needs the
synchronous VM module APIs to load the ESM-only cryptography packages that
address derivation uses. Plain Node handles them fine on 22, so the runtime does
not need the newer version.

## Reaching the machine

A watcher polls the registry and restarts a container when its image changes. It
is scoped **by container name**, so it acts only on the containers it was given.

The database and Redis are explicitly excluded from it. A major Postgres version
bump refuses to start against a data directory an older version wrote, so that
is one image to move by hand, deliberately, with a backup taken first.

Traffic arrives through a Cloudflare tunnel. The tunnel makes an **outbound**
connection, so there is no inbound port open and the origin address is never
exposed.

## Backups

Both databases are dumped nightly, compressed and timestamped, keeping the last
seven days. `pg_dump` is read-only, so it is safe to run while everything is up.

A ledger backup without the record of what the merchant was told is only half
the story, which is why the notifications database is in there too.

## Resource limits

Every container has a memory limit. On a small board, one runaway process
otherwise takes the whole machine down.
