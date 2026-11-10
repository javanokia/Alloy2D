# Contributing to Alloy2D

First off, thank you for considering contributing to **Alloy2D**! It's people like you that make Alloy2D a great tool for cross-platform mini-game developers.

---

## 🛠 Local Development Workflow

### Prerequisites
- [Node.js](https://nodejs.org/) >= 18.0.0
- [npm](https://www.npmjs.com/) >= 9.0.0

### Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/javanokia/Alloy2D.git
   cd Alloy2D
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Run development servers**:
   ```bash
   # Run Star Match3 Web dev server
   npm run dev

   # Run Yang Sheep Web dev server
   npm run dev:yang
   ```

---

## 🧪 Testing and Quality Checks

Before submitting a Pull Request, make sure all tests and type checks pass:

```bash
# Run unit tests (58 tests across 13 test suites)
npm test

# Run TypeScript static type checking across all workspaces
npm run typecheck

# Verify build outputs for both Web and WeChat Mini-Game
npm run build
```

---

## 📝 Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation changes only
- `style:` Changes that do not affect the meaning of the code (whitespace, formatting, etc.)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries

---

## 📬 Submitting a Pull Request

1. Create your feature branch (`git checkout -b feat/amazing-feature`).
2. Commit your changes (`git commit -m 'feat: add amazing feature'`).
3. Push to your branch (`git push origin feat/amazing-feature`).
4. Open a Pull Request with a clear title and description of your changes.
