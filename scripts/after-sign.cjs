/**
 * afterSign hook for electron-builder.
 *
 * macOS enforces that all binaries loaded by a process share the same Team ID.
 * When building without a paid Developer ID certificate, electron-builder signs
 * the app wrapper with an ad-hoc identity (no Team ID), but the Electron
 * Framework inside the bundle still carries Electron's original Team ID.
 * dyld then refuses to load it ("different Team IDs").
 *
 * This hook re-signs every binary inside the .app with an ad-hoc identity
 * after electron-builder's own signing step, so all components share
 * an empty Team ID and macOS accepts the bundle.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context;

  if (electronPlatformName !== 'darwin') return;

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn(`afterSign: app not found at ${appPath}, skipping re-sign`);
    return;
  }

  console.log(`afterSign: re-signing ${appPath} with ad-hoc identity`);

  // Sign all .dylib and binary files inside Frameworks first (inside-out order)
  const frameworks = path.join(appPath, 'Contents', 'Frameworks');
  if (fs.existsSync(frameworks)) {
    // Re-sign each framework bundle individually (deep is deprecated but reliable here)
    const entries = fs.readdirSync(frameworks);
    for (const entry of entries) {
      const fullPath = path.join(frameworks, entry);
      try {
        execSync(`codesign --force --sign - "${fullPath}"`, { stdio: 'inherit' });
      } catch {
        // Some entries may not be signable — ignore individual failures
      }
    }
  }

  // Re-sign the whole app with --deep to catch any remaining nested binaries
  execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' });

  console.log('afterSign: re-signing complete');
};
