const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Deduplicate React in monorepo — prevent "hooks of null" errors
// caused by pnpm resolving multiple physical copies of react.
const monorepoRoot = path.resolve(__dirname, "../..");
const reactDir = path.resolve(monorepoRoot, "node_modules/react");
const reactDomDir = path.resolve(monorepoRoot, "node_modules/react-dom");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect all react/react-dom imports to the single hoisted copy
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const rest = moduleName === "react" ? "" : moduleName.slice("react".length);
    return context.resolveRequest(
      { ...context, originModulePath: path.join(reactDir, "package.json") },
      reactDir + rest,
      platform
    );
  }
  if (moduleName === "react-dom" || moduleName.startsWith("react-dom/")) {
    const rest = moduleName === "react-dom" ? "" : moduleName.slice("react-dom".length);
    return context.resolveRequest(
      { ...context, originModulePath: path.join(reactDomDir, "package.json") },
      reactDomDir + rest,
      platform
    );
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config);
