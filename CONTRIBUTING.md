# Contributing to PolyPlan MCP

First off, thank you for considering contributing to PolyPlan! We welcome all contributions, from bug reports to new features.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/polyplan-mcp.git
   cd polyplan-mcp
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

## Building and Running Locally

To compile the TypeScript code:
```bash
npm run build
```

To test your local build:
```bash
npm run dev
```

## Manual Testing

You can manually test changes by running:
```bash
node dist/index.js init
```
To test the MCP integration, point your CLI tool's MCP configuration to your local `dist/index.js` file instead of the globally installed package.

## Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Make sure your code builds successfully (`npm run build`).
3. Update documentation (like `README.md`) if you are changing functionality.
4. Submit your PR with a clear description of the changes and the problem they solve.

## Code Style
- We use TypeScript and ESM (`"type": "module"`).
- Keep file I/O operations asynchronous.
- Please ensure code is properly formatted and adheres to the project's existing linting rules before submitting.