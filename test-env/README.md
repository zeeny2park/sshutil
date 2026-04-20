# VR Shell Lab

이 디렉터리는 `su -` 와 `vrctl 31 bash` 뒤에만 다음 hop SSH/SFTP가 가능한 상황을 재현하는 시험 환경입니다.

구성은 다음과 같습니다.

- `vr-gateway`
  - 호스트에서 `127.0.0.1:4222` 로 접속하는 첫 번째 SSH 노드
  - 기본 namespace 에서는 `3.3.3.3:22` 로 갈 수 없음
  - `su -` 후 `vrctl 31 bash` 를 실행하면 `vr31` namespace 로 들어감
- `target`
  - `vr31` namespace 에서만 접근 가능한 최종 SSH/SFTP 노드
  - IP 는 `3.3.3.3`, 게이트웨이 쪽 인터페이스는 `3.3.3.1`

## 시작

```bash
docker compose -f test-env/docker-compose.vr-lab.yml up -d --build
```

## 샘플 설정

테스트 전용 홈 디렉터리를 써서 기존 `~/.sshutil/targets.yaml` 을 건드리지 않는 방법입니다.

```bash
TMP_HOME="$(mktemp -d)"
mkdir -p "$TMP_HOME/.sshutil"
cp test-env/targets.vr-lab.yaml "$TMP_HOME/.sshutil/targets.yaml"
HOME="$TMP_HOME" node bin/sshutil.js list
```

## 수동 확인

연결 자체는 `vrctl` 이전에는 실패하고, `vrctl` 이후에는 성공하는지를 직접 볼 수 있습니다.

```bash
ssh -p 4222 gate1@127.0.0.1
nc -vz 3.3.3.3 22
su -
vrctl 31 bash
nc -vz 3.3.3.3 22
```

로그인 정보:

- gateway user: `gate1` / `gate-password`
- gateway root: `root` / `root-password`
- target user: `targetuser` / `target-password`

## sshutil 시험

```bash
HOME="$TMP_HOME" node bin/sshutil.js exec vr-lab "whoami"
HOME="$TMP_HOME" node bin/sshutil.js download vr-lab:/home/targetuser/hello.txt ./hello.txt --method sftp
HOME="$TMP_HOME" node bin/sshutil.js upload ./README.md vr-lab:/home/targetuser/upload/README.md --method sftp
```

## 자동 smoke test

```bash
test-env/run-vr-lab-smoke.sh
```

이 스크립트는 환경을 올리고 다음 두 가지를 확인합니다.

- 기본 namespace 에서는 `3.3.3.3:22` 에 직접 접근할 수 없는지
- `vr31` namespace 에서는 같은 주소로 접근할 수 있는지

현재 `sshutil` 동작까지 같이 재현하려면 아래처럼 실행할 수 있습니다.

```bash
test-env/run-vr-lab-smoke.sh --with-sshutil
```

이 옵션은 현재 구현 상태를 그대로 검증하므로, proxy hop 이 완성되지 않았으면 실패 재현에 사용됩니다.
