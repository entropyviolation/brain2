# deploy/oracle

_Last mapped: 2026-10-31_

> **Temporary, and a bandaid.** This folder sets up a relay on the Oracle Free
> VM. It is a stopgap until Brain2 has a reliable always-on device (Boa, or a
> Mac mini). Do not build new features on it. Plan, tiers,
> and the exit plan: [`../../docs/ORACLE_INTERIM_SYNC.md`](../../docs/ORACLE_INTERIM_SYNC.md).

Design and threat table: [`../../docs/ORACLE_CAPTURE_BOX.md`](../../docs/ORACLE_CAPTURE_BOX.md). Step-by-step setup: [`../../docs/BIM_SETUP_FOR_BEGINNERS.md`](../../docs/BIM_SETUP_FOR_BEGINNERS.md).

| File | What it is |
| --- | --- |
| `brain2-capture.service` | systemd unit. Starts `capture-box.mjs` after the tailnet address is up. |
| `capture.env.example` | Copy to `/etc/brain2-capture.env` on the VM (mode 600). Never commit the real one. |

The VM also needs four files from `scripts/` in `/opt/brain2-capture`: `capture-box.mjs`, `sealed-box.mjs`, `capture-filter.mjs`, `capture-upload.mjs`.

**Planned:** `BRAIN2_HOST_ROLE=relay` in the env file, so logs and `/health` show that this host is the temporary relay. Nothing reads it yet.

When the home server is up, retire this VM by following the Exit plan in `ORACLE_INTERIM_SYNC.md`. Keep these files; they are the same ones the home server can run.
