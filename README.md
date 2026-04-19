# 💻 SSHUtil — Multi-Hop SSH Manager

**SSHUtil** is a powerful, TUI-driven SSH client designed to simplify connections to complex infrastructures. It supports multi-hop SSH (jump hosts), interactive file browsing with high-speed transfers, and a full native terminal experience.

---

## ✨ Features

- **🔗 Multi-Hop SSH**: Seamlessly tunnel through multiple jump hosts to reach your target server.
- **🖥️ Premium TUI**: A beautiful, responsive terminal user interface built with Ink.
- **📁 Dual-Pane File Explorer**: Browse local and remote file systems side-by-side.
- **🚀 Fast Transfers**: Uses `SFTP` with `fastGet`/`fastPut` for reliable, high-speed file transfers.
- **⌨️ Native Terminal**: Full PTY proxying for a 100% native SSH shell experience (supports `vi`, `top`, tabs, etc.).
- **⚙️ YAML Config**: Easily manage hundreds of targets using a simple YAML configuration.

---

## 🚀 Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **NPM**: v9.0.0 or higher

### Steps
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sshutil
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the TUI**:
   This step is **mandatory** as it bundles the React components into a single executable script.
   ```bash
   npm run build
   ```

4. **(Optional) Link for global usage**:
   ```bash
   npm link
   ```
   Now you can use the `sshutil` command from anywhere.

---

## 🛠️ Configuration

Create or edit your targets in `config/targets.yaml`.

```yaml
targets:
  prod-server:
    host: 10.0.1.50
    user: admin
    auth:
      type: password
      value: secret123
    hops:
      - host: jump.example.com
        user: jumpuser
        auth:
          type: agent # Supports password, key-file, or agent

  test-multi-hop:
    host: target-server
    user: targetuser
    auth:
      type: password
      value: targetpass
    hops:
      - host: 127.0.0.1
        port: 2222
        user: jumpuser
        auth:
          type: password
          value: jumppass
```

---

## 📖 Usage

### TUI Mode (Recommended)
Launch the interactive dashboard:
```bash
sshutil tui
```
- **Dashboard**: Press `C` to select a target and connect.
- **File Explorer**: Press `F` to manage files. Use `Tab` to switch between Local/Remote. Press `C` to copy (Upload/Download).
- **Terminal**: Press `T` to open a full native terminal. Type `exit` or `Ctrl+D` to return to the dashboard.
- **Navigation**: Use `↑`/`↓` or `j`/`k` to move, `Enter` to select.

### CLI Mode
For quick operations without the TUI:
```bash
# List all configured targets
sshutil list

# Connect to a target directly
sshutil connect <target-name>

# Download a file
sshutil download <target-name>:/remote/path ./local-path

# Upload a file
sshutil upload ./local-file <target-name>:/remote/path
```

---

## ⚠️ Constraints & Disclaimers

- **SFTP Only**: File transfers require the SFTP subsystem to be enabled on the remote server.
- **Terminal Emulation**: The "Native Terminal" mode relies on your local terminal's ability to handle raw PTY input. Support for complex escape codes (colors, cursor positioning) depends on your local environment (e.g., iTerm2, Kitty, Alacritty).
- **Security**: Password values are stored in plain text in `targets.yaml`. It is highly recommended to use `type: agent` or `type: key-file` for production environments.
- **Home Directory**: SSHUtil automatically attempts to resolve the remote user's home directory. If it fails, it defaults to `/`.

---

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License
This project is licensed under the MIT License.
