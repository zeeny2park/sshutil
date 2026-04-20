#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PID=""
TARGET_PID=""

log() {
  printf '[vr-lab] %s\n' "$*"
}

cleanup() {
  set +e

  if [[ -n "$TARGET_PID" ]]; then
    kill "$TARGET_PID" 2>/dev/null || true
    wait "$TARGET_PID" 2>/dev/null || true
  fi

  if [[ -n "$GATEWAY_PID" ]]; then
    kill "$GATEWAY_PID" 2>/dev/null || true
    wait "$GATEWAY_PID" 2>/dev/null || true
  fi

  ip netns del targetns 2>/dev/null || true
  ip netns del vr31 2>/dev/null || true
}

trap cleanup EXIT INT TERM

ensure_user() {
  local user="$1"
  if ! id "$user" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$user"
  fi
}

prepare_users() {
  ensure_user gate1
  ensure_user targetuser

  echo 'gate1:gate-password' | chpasswd
  echo 'root:root-password' | chpasswd
  echo 'targetuser:target-password' | chpasswd

  mkdir -p /home/targetuser/upload
  printf 'hello from vr-lab target\n' > /home/targetuser/hello.txt
  chown -R targetuser:targetuser /home/targetuser
}

install_vrctl() {
  cat >/usr/local/bin/vrctl <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: vrctl <vr-id> <command> [args...]" >&2
  exit 1
fi

vr_id="$1"
shift

if [[ "$vr_id" != "31" ]]; then
  echo "vrctl: unsupported vr-id: $vr_id" >&2
  exit 1
fi

exec ip netns exec vr31 "$@"
EOF

  chmod +x /usr/local/bin/vrctl
}

prepare_namespaces() {
  ip netns del targetns 2>/dev/null || true
  ip netns del vr31 2>/dev/null || true

  ip netns add vr31
  ip netns add targetns

  ip link add veth-vr31 type veth peer name veth-target
  ip link set veth-vr31 netns vr31
  ip link set veth-target netns targetns

  ip -n vr31 link set lo up
  ip -n targetns link set lo up

  ip -n vr31 addr add 3.3.3.1/24 dev veth-vr31
  ip -n targetns addr add 3.3.3.3/24 dev veth-target

  ip -n vr31 link set veth-vr31 up
  ip -n targetns link set veth-target up
}

start_sshd() {
  mkdir -p /var/run/sshd
  ssh-keygen -A

  /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config_gateway &
  GATEWAY_PID="$!"

  ip netns exec targetns /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config_target &
  TARGET_PID="$!"
}

main() {
  prepare_users
  install_vrctl
  prepare_namespaces
  start_sshd

  log 'gateway sshd listening on 0.0.0.0:2222'
  log 'target sshd listening on 3.3.3.3:22 inside vr31/target namespaces'

  wait -n "$GATEWAY_PID" "$TARGET_PID"
}

main "$@"
