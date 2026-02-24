const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

function resolvePackageDir(packageName) {
  return path.dirname(
    require.resolve(`${packageName}/package.json`, {
      paths: [projectRoot, workspaceRoot],
    })
  );
}

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: resolvePackageDir('react'),
  'react-dom': resolvePackageDir('react-dom'),
};

module.exports = config;
