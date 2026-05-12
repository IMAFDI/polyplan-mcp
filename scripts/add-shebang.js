#!/usr/bin/env node
/**
 * PolyPlan MCP — Post-Build Shebang Injector
 *
 * Ensures dist/index.js starts with #!/usr/bin/env node
 * and has executable permissions set.
 * Runs automatically via the "postbuild" script in package.json.
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const file = 'dist/index.js';
const shebang = '#!/usr/bin/env node\n';

const content = fs.readFileSync(file, 'utf8');
if (!content.startsWith(shebang)) {
  fs.writeFileSync(file, shebang + content);
  console.log('✓ Shebang added to dist/index.js');
} else {
  console.log('✓ Shebang already present in dist/index.js');
}

// Set executable bit (no-op on Windows but harmless)
try {
  execSync('chmod +x dist/index.js');
  console.log('✓ chmod +x dist/index.js');
} catch {
  // Windows — skip silently
}
