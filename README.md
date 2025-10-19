# 🤖 TODO IssueOps

[![GitHub Marketplace](https://img.shields.io/badge/GitHub-Marketplace-blue)](https://github.com/marketplace)
[![Docker](https://img.shields.io/badge/runs%20on-Docker-blue)](https://docs.github.com/en/actions/creating-actions/creating-a-docker-container-action)
[![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-blue)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A GitHub Action that automatically creates, updates, and closes GitHub issues from TODO comments in your code. Never lose track of your TODOs again!

## ✨ Features

- 🔍 **Automatic TODO Detection** - Scans code changes for TODO/FIXME comments
- 📝 **Issue Creation** - Creates GitHub issues for new TODO comments
- 🔄 **Issue Management** - Automatically closes issues when TODOs are removed
- 🚫 **Duplicate Prevention** - Uses fingerprinting to avoid duplicate issues
- 🔗 **Direct Code Links** - Issues include links to the exact code location
- 🏷️ **Customizable Labels** - Add custom labels and assignees to issues
- 🌐 **Multi-Language Support** - Works with any programming language

## 🚀 Quick Start

Add this action to your workflow file (`.github/workflows/todo-issueops.yml`):

```yaml
name: 'TODO IssueOps'
on:
  pull_request:
    types: [opened, synchronize] # Runs when a PR is opened or updated

jobs:
  track_todos:
    runs-on: ubuntu-latest
    steps:
      - name: 'Checkout Code'
        uses: actions/checkout@v4

      - name: 'Run TODO IssueOps'
        uses: vesharma-dev/todo-bot@v1.0.4 # Use your GitHub username and the new tag
        with:
          # The default token is sufficient for most cases
          token: ${{ secrets.GITHUB_TOKEN }}
          # Optional: customize keywords, labels, or assignees
          # keywords: 'TODO,FIXME,HACK,NOTE'
          # labels: 'todo, needs-attention'
          # assignees: 'vesharma-dev'
```

## 📖 How It Works

### 1. **Code Scanning**

When you push code, TODO Bot analyzes the git diff to identify:

- ✅ **New TODO comments** - Creates issues
- ❌ **Removed TODO comments** - Closes corresponding issues

### 2. **Comment Recognition**

Supports multiple comment styles across languages:

```javascript
// TODO: Add user authentication
/* TODO: Optimize database queries */
```

```python
# TODO: Implement error handling
# FIXME: Handle edge case when list is empty
```

```html
<!-- TODO: Add responsive design -->
```

### 3. **Issue Management**

Each TODO becomes a GitHub issue with:

- **Title**: The TODO content
- **Body**: File location, line number, and direct code link
- **Labels**: Configurable (default: `todo-issueops`)
- **Fingerprinting**: SHA-256 hash prevents duplicates

## ⚙️ Configuration

### Inputs

| Parameter   | Description                            | Required | Default               |
| ----------- | -------------------------------------- | -------- | --------------------- |
| `token`     | GitHub token for API access            | ✅       | `${{ github.token }}` |
| `keywords`  | Comma-separated keywords to search for | ❌       | `TODO,FIXME`          |
| `labels`    | Comma-separated labels for new issues  | ❌       | `todo-issueops`       |
| `assignees` | Comma-separated GitHub usernames       | ❌       | none                  |

### Example Configurations

#### Minimal Setup

```yaml
- name: TODO Bot
  uses: vesharma-dev/todo-issueops@v1
```

#### Advanced Setup

```yaml
- name: TODO Bot
  uses: vesharma-dev/todo-issueops@v1
  with:
    keywords: 'TODO,FIXME,HACK,NOTE,BUG'
    labels: 'todo-issueops,technical-debt,enhancement'
    assignees: 'developer1,developer2'
```

## 🛠️ Development & Testing

### Prerequisites

```bash
# Install dependencies
brew install act docker
pnpm install
```

### Quick Setup

```bash
# Build TypeScript
pnpm build

# Test locally (syntax only)
pnpm run manual-test

# Test with GitHub Actions emulator
pnpm run emulator
```

### Available Scripts

| Script          | Command                | Description                                           |
| --------------- | ---------------------- | ----------------------------------------------------- |
| **Manual Test** | `pnpm run manual-test` | Tests TypeScript logic with mock data                 |
| **Emulator**    | `pnpm run emulator`    | Interactive menu for full workflow testing with `act` |
| **Build**       | `pnpm build`           | Compiles TypeScript to `dist/`                        |
| **Clean**       | `pnpm run clean`       | Removes build artifacts                               |

### Testing Options

#### 1. **Quick Logic Test**

```bash
pnpm run manual-test
```

- ✅ Tests TypeScript compilation and parsing
- ✅ Uses mock GitHub data (safe, no API calls)
- ✅ Validates input handling and TODO detection

#### 2. **Full Workflow Test**

```bash
pnpm run emulator
```

Interactive menu with options:

1. **Create test commit** - Sets up git repo with test TODO files
2. **Run basic act test** - Tests workflow without real GitHub API
3. **Run with GitHub token** - Tests with real GitHub API calls
4. **Simulate TODO changes** - Tests adding/removing TODOs
5. **Build Docker image** - Tests containerization
6. **Debug build issues** - Troubleshooting tools

#### 3. **Real GitHub API Testing**

For testing with actual GitHub API:

1. **Create Personal Access Token:**
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens)
   - Select scopes: `repo` (for private repos) or `public_repo` (for public repos)

2. **Add token to `.secrets` file:**

   ```bash
   echo 'GITHUB_TOKEN=ghp_your_token_here' > .secrets
   ```

3. **Run emulator and choose option 3**

### Project Structure

```
todo-issueops/
├── src/index.ts          # Main TypeScript logic
├── dist/                 # Compiled JavaScript
├── scripts/              # Testing scripts
├── test-files/           # Sample files with TODOs
├── action.yml           # GitHub Action metadata
├── Dockerfile           # Container configuration
└── .secrets             # Local GitHub token (gitignored)
```

### Common Issues & Solutions

| Issue                | Solution                                 |
| -------------------- | ---------------------------------------- |
| `act not found`      | `brew install act`                       |
| `Docker not running` | Start Docker Desktop                     |
| `Permission denied`  | `chmod +x scripts/*.sh`                  |
| `TypeScript errors`  | `pnpm build` to check compilation        |
| `Platform errors`    | Use option 6 in emulator for debug build |

### Development Workflow

1. **Edit code** in `src/index.ts`
2. **Test logic**: `pnpm run manual-test`
3. **Test workflow**: `pnpm run emulator` → option 2
4. **Test with real API**: Use option 3 with `.secrets` file

## 📋 Example Workflow

### Before - Your Code

```typescript
// src/api.ts
export async function fetchUsers() {
  // TODO: Add pagination support
  // FIXME: Handle network errors properly
  return fetch('/api/users');
}
```

### After Push - Generated Issue

**Issue #42: "TODO: Add pagination support"**

```markdown
This issue was automatically created from a TODO comment in the code.

**File:** `src/api.ts`
**Line:** 3
**TODO:** TODO: Add pagination support

**Link to code:** [View in repository](https://github.com/your-repo/blob/abc123/src/api.ts#L3)

---

_This issue is managed by TODO Bot. Do not edit the fingerprint below._

<!-- todo-issueops-FINGERPRINT: a1b2c3d4e5f6g7h8 -->
```

### When TODO Removed - Auto-closed

The issue gets automatically closed with a comment explaining the TODO was removed.

## 🔧 Advanced Usage

### Custom Keywords

```yaml
keywords: 'TODO,FIXME,HACK,BUG,OPTIMIZE,REFACTOR,SECURITY'
```

### Branch-Specific

```yaml
on:
  push:
    branches: [main]
    paths: ['**.ts', '**.js', '**.py']
```

### Multiple Workflows

Create separate workflows for different teams:

- `todo-issueops-critical.yml` - Urgent TODOs
- `todo-issueops-frontend.yml` - UI-related TODOs
- `todo-issueops-backend.yml` - API-related TODOs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Test your changes (`pnpm run manual-test && pnpm run emulator`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push and open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/vesharma-dev/todo-issueops/issues)
- 💡 **Feature Requests**: [Open an issue](https://github.com/vesharma-dev/todo-issueops/issues)
- 📧 **Questions**: [Discussions](https://github.com/vesharma-dev/todo-issueops/discussions)

---

<div align="center">
  <strong>Made with ❤️ for developers who love organized code</strong>
</div>

### Example Configurations

#### Minimal Setup

```yaml
- name: TODO Bot
  uses: vesharma-dev/todo-issueops@v1
```

#### Advanced Setup

```yaml
- name: TODO Bot
  uses: vesharma-dev/todo-issueops@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    keywords: 'TODO,FIXME,HACK,NOTE,BUG'
    labels: 'todo-issueops,technical-debt,enhancement'
    assignees: 'developer1,developer2,team-lead'
```

#### Team-Specific Setup

```yaml
- name: Frontend TODOs
  uses: vesharma-dev/todo-issueops@v1
  with:
    keywords: 'TODO,FIXME'
    labels: 'frontend,todo-issueops'
    assignees: 'frontend-team-lead'

- name: Backend TODOs
  uses: vesharma-dev/todo-issueops@v1
  with:
    keywords: 'TODO,FIXME,OPTIMIZE'
    labels: 'backend,todo-issueops'
    assignees: 'backend-team-lead'
```

## 🛠️ Development

### Prerequisites

- Node.js 22+
- pnpm
- Docker

### Setup

```bash
# Clone the repository
git clone https://github.com/vesharma-dev/todo-issueops.git
cd todo-issueops

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run tests
pnpm test
```

### Project Structure

```
todo-issueops/
├── src/
│   └── index.ts          # Main application logic
├── lib/                  # Compiled JavaScript (generated)
├── action.yml           # GitHub Action metadata
├── Dockerfile           # Container configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

### Building

```bash
# Compile TypeScript
pnpm build

# Build Docker image
docker build -t todo-issueops .

# Test locally
docker run --rm todo-issueops
```

## 📋 Example Workflow

Here's what happens when you commit code with TODOs:

### 1. **Before** - Your Code

```typescript
// src/api.ts
export async function fetchUsers() {
  // TODO: Add pagination support
  // FIXME: Handle network errors properly
  return fetch('/api/users');
}
```

### 2. **After Push** - Generated Issues

**Issue #42: "TODO: Add pagination support"**

```markdown
This issue was automatically created from a TODO comment in the code.

**File:** `src/api.ts`
**Line:** 3
**TODO:** TODO: Add pagination support

**Link to code:** [View in repository](https://github.com/your-repo/blob/abc123/src/api.ts#L3)

---

_This issue is managed by TODO Bot. Do not edit the fingerprint below._

<!-- todo-issueops-FINGERPRINT: a1b2c3d4e5f6g7h8 -->
```

### 3. **When TODO is Removed** - Auto-closed

The issue gets automatically closed with a comment explaining the TODO was removed.

## 🧪 Local Development & Testing

### Prerequisites

- Docker Desktop installed and running
- Node.js 22+ and pnpm
- `act` tool for local GitHub Actions testing

### Quick Setup

```bash
# Install act (macOS)
brew install act

# Install dependencies
pnpm install

# Build TypeScript
pnpm build
```

### Testing Options

#### 1. **Full Workflow Testing with `act` (Recommended)**

Test the complete GitHub Action workflow locally:

```bash
# Use the interactive testing script
./local-test.sh

# Or run act directly
act push -W .github/workflows/dev-test.yml
```

#### 2. **Manual Logic Testing**

Test just the TypeScript logic without GitHub Actions:

```bash
# Quick syntax and logic test
./manual-test.sh

# Or run directly with mock environment
pnpm build && node lib/index.js
```

#### 3. **Docker Testing**

Test the Docker container locally:

```bash
# Build Docker image
docker build -t todo-issueops-local .

# Run container (requires environment setup)
docker run --rm -e INPUT_TOKEN=test todo-issueops-local
```

### Testing with Real GitHub API

To test with actual GitHub API calls:

1. **Create a Personal Access Token** in GitHub (Settings → Developer settings → Personal access tokens)
2. **Run with token**:
   ```bash
   act push -s GITHUB_TOKEN=your_token_here
   ```

### Test Files Structure

```
test-files/
├── user-service.js     # JavaScript with TODO comments
├── data_processor.py   # Python with FIXME comments
└── (add your own test files)
```

### Debugging Tips

1. **Enable debug output**:

   ```bash
   act push --verbose
   ```

2. **Check Docker logs**:

   ```bash
   docker logs <container_id>
   ```

3. **Validate action.yml**:

   ```bash
   act --list  # Should show your workflows
   ```

4. **Test specific events**:
   ```bash
   act pull_request  # Test PR events
   act push          # Test push events
   ```

## 🔧 Advanced Usage

### Custom Keywords

Track different types of technical debt:

```yaml
keywords: 'TODO,FIXME,HACK,BUG,OPTIMIZE,REFACTOR,SECURITY'
```

### Environment-Specific TODOs

```yaml
# Only run on main branch
on:
  push:
    branches: [ main ]

# Only for specific file types
on:
  push:
    paths:
      - '**.ts'
      - '**.js'
      - '**.py'
```

### Multiple Workflows

Create separate workflows for different teams or priorities:

- `todo-issueops-critical.yml` - For urgent TODOs
- `todo-issueops-frontend.yml` - For UI-related TODOs
- `todo-issueops-backend.yml` - For API-related TODOs

### Development Guidelines

- Write TypeScript with strict typing
- Add tests for new features
- Update documentation
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- Inspired by the need to never lose track of TODOs again
- Thanks to the open source community for feedback and contributions

## 📞 Support

- 🐛 **Bug Reports**: [Open an issue](https://github.com/vesharma-dev/todo-issueops/issues)
- 💡 **Feature Requests**: [Open an issue](https://github.com/vesharma-dev/todo-issueops/issues)
- 📧 **Questions**: [Discussions](https://github.com/vesharma-dev/todo-issueops/discussions)

---

<div align="center">
  <strong>Made with ❤️ for developers who love organized code</strong>
</div>
