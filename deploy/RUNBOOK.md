# LensAI Capture — Deploy Runbook (fresh Ubuntu VPS)

Phase 1 is not done until the capture daemon is **running on an always-on host,
backed up, with a rehearsed restore, and rows landing**. This runbook takes a
clean Ubuntu 22.04/24.04 VPS to that state. Run it as a sudo-capable user.

Files referenced live in `deploy/`: `lensai-capture.service`, `capture.env.example`,
`litestream.yml`, `backup.sh`, `restore-test.sh`, plus `scripts/restore-check.ts`.

---

## 1. System user and directories

```bash
sudo useradd --system --create-home --home-dir /opt/lensai --shell /usr/sbin/nologin lensai
sudo mkdir -p /var/lib/lensai/backups /etc/lensai
sudo chown -R lensai:lensai /opt/lensai /var/lib/lensai
```

## 2. Node 24 (the toolchain is ABI-locked to it)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # must print v24.x
```

## 3. Get the code and install

```bash
sudo -u lensai git clone https://github.com/lensaiteam/LensAI.git /opt/lensai
cd /opt/lensai
sudo -u lensai npm ci          # installs better-sqlite3 (prebuilt for Node 24), tsx, etc.
```

## 4. Environment (secrets live on the box, never in the repo)

```bash
sudo cp deploy/capture.env.example /etc/lensai/capture.env
sudo nano /etc/lensai/capture.env        # set FRED_API_KEY + backup targets
sudo chown root:lensai /etc/lensai/capture.env
sudo chmod 640 /etc/lensai/capture.env
```

`CAPTURE_DB_PATH=/var/lib/lensai/capture.db` is set in the template.

## 5. Initialize the corpus

```bash
sudo -u lensai --preserve-env=CAPTURE_DB_PATH \
  env $(grep -v '^#' /etc/lensai/capture.env | xargs) \
  node --import tsx /opt/lensai/scripts/migrate.ts
```

## 6. Install and start the daemon (Restart=always)

```bash
sudo cp deploy/lensai-capture.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lensai-capture
systemctl status lensai-capture --no-pager
journalctl -u lensai-capture -f            # watch structured JSON ingest logs
```

`Restart=always` + `RestartSec=5` means a crash or reboot brings it back; the
scheduler is idempotent and restart-safe (state lives in `ingest_runs`), so no
duplicate rows.

## 7. Backup — choose ONE

### 7a. Litestream (preferred: continuous replication)

```bash
# install litestream (see litestream.io for the current .deb), then:
sudo cp deploy/litestream.yml /etc/litestream.yml
sudo nano /etc/litestream.yml               # bucket/path/endpoint
sudo tee /etc/default/litestream >/dev/null <<'EOF'
LITESTREAM_ACCESS_KEY_ID=...
LITESTREAM_SECRET_ACCESS_KEY=...
EOF
sudo chmod 600 /etc/default/litestream
sudo systemctl enable --now litestream
```

### 7b. Cron snapshot fallback (if no litestream)

Set `BACKUP_S3_URI` or `BACKUP_RCLONE_REMOTE` in `/etc/lensai/capture.env`, then:

```bash
sudo chmod +x /opt/lensai/deploy/backup.sh
# hourly snapshot + off-machine ship, retaining 14 local copies:
( sudo -u lensai crontab -l 2>/dev/null; \
  echo "0 * * * * set -a; . /etc/lensai/capture.env; set +a; /opt/lensai/deploy/backup.sh >> /var/lib/lensai/backup.log 2>&1" ) \
  | sudo -u lensai crontab -
```

## 8. RESTORE TEST — mandatory, rehearse now

**A backup that has never been restored is a hope, not a backup.** Do this once
during setup and periodically after.

```bash
sudo apt-get install -y sqlite3   # optional; restore-check uses better-sqlite3, not the CLI

# From a snapshot file (fallback path):
sudo -u lensai /opt/lensai/deploy/restore-test.sh \
  "$(ls -1t /var/lib/lensai/backups/capture-*.db | head -1)"

# OR from the litestream replica:
sudo -u lensai /opt/lensai/deploy/restore-test.sh s3://your-bucket/lensai/capture
```

It restores into a throwaway file and runs `scripts/restore-check.ts`, which
asserts `integrity_check = ok` and **rows from ≥3 article sources and ≥4 factor
streams**. It exits non-zero (and prints `RESTORE CHECK FAILED`) if not — treat
that as a release blocker.

> Rehearsed locally on 2026-08-02 against a real snapshot: `integrity_check: ok`,
> 5 article sources, 6 factor streams, `RESTORE CHECK PASSED`.

## 9. Health verification (close Phase 1)

```bash
sudo -u lensai --preserve-env \
  env $(grep -v '^#' /etc/lensai/capture.env | xargs) \
  node --import tsx /opt/lensai/scripts/tail.ts
```

`tail` prints corpus counts, **last-success-per-source** (a stale timestamp = a
gap), and recent runs incl. errors. **Phase 1 is done when tail shows rows from
≥3 article sources and ≥4 factor streams and every source's last success is
recent.** If `FRED_API_KEY` is unset, the two macro jobs will show `error` /
`lastSuccess=NEVER` — expected, and never faked; add the key to close them.

## Operations quick reference

| Action | Command |
|---|---|
| Live logs | `journalctl -u lensai-capture -f` |
| Restart | `sudo systemctl restart lensai-capture` |
| Health / gaps | `node --import tsx scripts/tail.ts` |
| Manual snapshot | `deploy/backup.sh` |
| Restore test | `deploy/restore-test.sh <snap|replica>` |
| Update code | `git pull && npm ci && systemctl restart lensai-capture` |
