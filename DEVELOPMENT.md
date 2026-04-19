# 🛠️ sshutil Development Guide & Handover Manual

신입 개발자를 위한 `sshutil` 프로젝트 가이드입니다. 이 문서는 프로젝트의 구조, 설계 철학, 그리고 새로운 기능을 추가하는 방법을 설명합니다.

---

## 1. 프로젝트 개요 (System Overview)

`sshutil`은 단순한 SSH 클라이언트를 넘어, **Multi-Hop (ProxyJump)**과 **계정 전환(su -, sudo)**이 포함된 복잡한 접속 환경을 자동화하고, TUI(Terminal User Interface)를 통해 편리한 파일 전송과 터미널 접속을 제공하는 도구입니다.

### 핵심 기술 스택
- **Runtime**: Node.js
- **SSH Library**: `ssh2` (전통적이고 안정적인 SSH2 프로토콜 구현체)
- **TUI Framework**: `Ink` (React를 터미널에서 사용할 수 있게 해주는 프레임워크)
- **Bundler**: `esbuild` (TUI 컴포넌트들을 하나로 묶어 실행 속도를 높임)

---

## 2. 아키텍처 및 내부 구조

프로젝트는 크게 **Core**, **CLI**, **TUI** 세 가지 레이어로 나뉩니다.

### 📂 디렉토리 구조
- `bin/`: 실행 파일(`sshutil`)이 위치합니다.
- `src/core/`: SSH 연결 관리, 상태 머신, 파일 전송 등 핵심 로직이 들어있습니다.
- `src/cli/`: 기본적인 커맨드라인 인터페이스 명령어들입니다.
- `src/tui/`: React 기반의 TUI 컴포넌트와 전용 훅(Hooks)들이 위치합니다.
- `scripts/`: 빌드 및 자동화 스크립트입니다.

### 주요 클래스 설명
1.  **`ConnectionManager.js`**: 전체 연결 체인을 관리합니다. 1차 점프 서버에서 최종 목적지까지 `forwardOut`으로 터널링을 구성하거나, 중간에 커맨드(su 등)가 필요한 경우 이를 처리합니다.
2.  **`HopStateMachine.js`**: 각 접속 단계(Hop)의 상태를 관리합니다. 특히 패스워드 입력 대기, 프롬프트 확인 등 "Expect" 패턴의 로직을 담당합니다.
3.  **`FileTransfer.js`**: SFTP를 활용한 파일 업로드/다운로드 로직입니다. 성능을 위해 `fastGet`/`fastPut` API를 사용하며 진행 상태(Progress)를 이벤트로 발생시킵니다.

---

## 3. TUI 동작 원리 (Special Note)

TUI는 React와 유사한 **Ink**를 사용합니다. 하지만 터미널 모드 구현 시 매우 중요한 기술적 장치가 포함되어 있습니다.

### `Terminal.jsx`의 PTY Proxy
Ink는 화면 전체를 리액트 상태에 따라 다시 그립니다. 하지만 SSH 터미널은 실시간으로 데이터를 주고받아야 하므로 Ink의 렌더링 방식과 충돌할 수 있습니다.
- **해결책**: 터미널 모드로 진입하면 `App.jsx`의 UI 갱신 루프를 일시 정지하고, `Terminal.jsx`가 원격 SSH 스트림을 로컬의 `process.stdin`/`stdout`에 **직접 연결(Proxy)**합니다.
- 이를 통해 원격 서버의 프롬프트와 Vim 같은 도구들이 깨지지 않고 완벽하게 작동합니다.

---

## 4. 개발 워크플로우 (How to Develop)

코드를 수정하고 반영하기 위해 다음 순서를 따르세요.

### 1단계: 프로젝트 연결
```bash
npm install
npm link
```
`npm link`를 수행하면 터미널 어디서든 `sshutil` 명령어를 바로 사용할 수 있습니다.

### 2단계: TUI 소스 수정 후 빌드
**중요**: TUI 코드를 수정했다면 반드시 빌드를 수행해야 반영됩니다.
```bash
npm run build
```
빌드 스크립트(`scripts/build-tui.js`)는 `src/tui/App.jsx`를 시작점으로 모든 의존성을 묶어 `dist/tui.js`를 생성합니다.

---

## 5. 기능 추가 가이드 (Tutorial)

### 새로운 CLI 명령어 추가하기
1.  `src/cli/commands/` 폴더 내에 새로운 파일을 생성합니다 (예: `ping.js`).
2.  `src/cli/index.js`에서 해당 명령어를 등록합니다.
3.  `core/ConnectionManager`를 이용해 서버에 접속하거나 명령을 내리는 로직을 작성합니다.

### TUI에 새로운 패널 추가하기
1.  `src/tui/components/`에 새로운 컴포넌트를 작성합니다.
2.  `App.jsx`에서 `mode` 상태를 추가하여 해당 컴포넌트를 보여줄 타이밍을 결정합니다.
3.  필요하다면 `src/tui/hooks/`에 전용 훅을 만들어 데이터 로직을 분리하세요.

---

## 6. 주의 사항 및 팁

-   **Error Handling**: SSH 연결은 네트워크 지연, 권한 거부 등 수많은 오류가 발생할 수 있습니다. `src/utils/errors.js`에 정의된 에러 타입을 활용하여 사용자에게 친절한 메시지를 보여주세요.
-   **Logging**: 개발 중에는 `logs/` 폴더의 로그 파일을 실시간으로 모니터링하면 디버깅이 쉽습니다. (`tail -f logs/app.log`)
-   **Security**: `targets.yaml`에 비밀번호가 평문으로 저장되므로, 운영 환경에서는 SSH Agent 등을 사용하는 것을 권장합니다.

---

이 프로젝트는 확장에 유연하게 설계되었습니다. 아키텍처를 믿고 마음껏 기능을 추가해 보세요! 🚀
