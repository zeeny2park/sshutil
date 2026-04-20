#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.vr-lab.yml"
TMP_HOME="$(mktemp -d)"
DOWNLOAD_PATH="$TMP_HOME/hello.txt"
UPLOAD_PATH="$TMP_HOME/upload.txt"
WITH_SSHUTIL=0

if [[ "${1:-}" == "--with-sshutil" ]]; then
  WITH_SSHUTIL=1
fi

cleanup() {
  docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
  rm -rf "$TMP_HOME"
}

trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" up -d --build

for _ in $(seq 1 30); do
  if bash -lc "exec 3<>/dev/tcp/127.0.0.1/4222" 2>/dev/null; then
    break
  fi
  sleep 1
done

mkdir -p "$TMP_HOME/.sshutil"
cp "$SCRIPT_DIR/targets.vr-lab.yaml" "$TMP_HOME/.sshutil/targets.yaml"

echo "[1/2] default namespace cannot reach target"
docker exec sshutil-vr-lab bash -lc "nc -vz -w 2 3.3.3.3 22 >/tmp/default-nc.log 2>&1; test \$? -ne 0"

echo "[2/2] vr31 namespace reaches target"
docker exec sshutil-vr-lab ip netns exec vr31 nc -vz -w 2 3.3.3.3 22

if [[ "$WITH_SSHUTIL" -eq 1 ]]; then
  printf 'upload smoke test via sshutil\n' > "$UPLOAD_PATH"

  echo "[sshutil] exec"
  HOME="$TMP_HOME" node "$REPO_ROOT/bin/sshutil.js" exec vr-lab "whoami"

  echo "[sshutil] download"
  HOME="$TMP_HOME" node "$REPO_ROOT/bin/sshutil.js" download \
    vr-lab:/home/targetuser/hello.txt \
    "$DOWNLOAD_PATH" \
    --method sftp

  echo "[sshutil] upload"
  HOME="$TMP_HOME" node "$REPO_ROOT/bin/sshutil.js" upload \
    "$UPLOAD_PATH" \
    vr-lab:/home/targetuser/upload/upload.txt \
    --method sftp
else
  echo
  echo "Lab is ready."
  echo "To reproduce with sshutil, run:"
  echo "  TMP_HOME=\"\$(mktemp -d)\""
  echo "  mkdir -p \"\$TMP_HOME/.sshutil\""
  echo "  cp \"$SCRIPT_DIR/targets.vr-lab.yaml\" \"\$TMP_HOME/.sshutil/targets.yaml\""
  echo "  HOME=\"\$TMP_HOME\" node \"$REPO_ROOT/bin/sshutil.js\" exec vr-lab \"whoami\""
fi

echo
echo "Smoke test passed."
