const fs = require('fs');
const path = require('path');

const DOCKER_MIRROR_PLACEHOLDER = '__DOCKER_MIRROR_URL__';
const DEFAULT_DOCKER_URL = 'https://download.docker.com';

// Path to the install.js file in @docker/actions-toolkit
const installJsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@docker',
  'actions-toolkit',
  'lib',
  'docker',
  'install.js'
);

// Path to the assets.js file in @docker/actions-toolkit
const assetsJsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@docker',
  'actions-toolkit',
  'lib',
  'docker',
  'assets.js'
);

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const patch of patches) {
    if (content.includes(patch.search)) {
      content = content.replace(patch.search, patch.replace);
      console.log(`Patched: ${patch.description}`);
      modified = true;
    } else if (content.includes(patch.replace)) {
      console.log(`Already patched: ${patch.description}`);
    } else {
      console.warn(`Pattern not found for: ${patch.description}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`File saved: ${filePath}`);
  }
}

// Patch install.js - replace hardcoded download.docker.com with dynamic mirror support
patchFile(installJsPath, [
  {
    description: 'Replace download.docker.com in downloadURL method',
    search: `return \`https://download.docker.com/\${platformOS}/static/\${channel}/\${platformArch}/\${component}-\${version}\${ext}\`;`,
    replace: `const dockerMirror = process.env.DOCKER_MIRROR || 'https://download.docker.com';
        return \`\${dockerMirror}/\${platformOS}/static/\${channel}/\${platformArch}/\${component}-\${version}\${ext}\`;`
  },
  {
    description: 'Update download log message to show actual mirror',
    search: `core.info(\`Downloading Docker \${version} from \${this.source.channel} at download.docker.com\`);`,
    replace: `const downloadMirror = process.env.DOCKER_MIRROR || 'https://download.docker.com';
                    core.info(\`Downloading Docker \${version} from \${this.source.channel} at \${downloadMirror}\`);`
  },
  {
    description: 'Update rootless extras download log message',
    search: `core.info(\`Downloading Docker rootless extras \${version} from \${this.source.channel} at download.docker.com\`);`,
    replace: `core.info(\`Downloading Docker rootless extras \${version} from \${this.source.channel} at \${process.env.DOCKER_MIRROR || 'https://download.docker.com'}\`);`
  }
]);

// Patch assets.js - replace get.docker.com in lima yaml template
// For macOS Lima provisioning, we inject the DOCKER_MIRROR env var into the bash script
// Use \\$ to escape the $ sign so ncc doesn't parse it as a template literal
patchFile(assetsJsPath, [
  {
    description: 'Replace get.docker.com in lima yaml provision script',
    search: 'curl -fsSL https://get.docker.com | sh -s -- --channel {{srcArchiveChannel}} --version {{srcArchiveVersion}}',
    replace: 'DOCKER_GET_SCRIPT_URL="\\${DOCKER_MIRROR:-https://get.docker.com}"; curl -fsSL "\\$DOCKER_GET_SCRIPT_URL" | sh -s -- --channel {{srcArchiveChannel}} --version {{srcArchiveVersion}}'
  }
]);

console.log('\\nPatch completed successfully!');
