/*
 * build.js
 *
 * This is a singleton responsible for generating an electron binary for the
 * tests to drive. The binary is built once, and then the path is cached for
 * subsequent requests.
 */
'use strict'

/* Require in deps */
const electronPackager = require('electron-packager')
const os = require('os')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const packageJson = require('../package.json')

/* Define global variables for module */

// We will cache the path to the compiled electron app for future invocations
let cachedBuild = null

// This is the directory we will drop built artifacts into
const outDir = path.join(__dirname, '..', 'build')

// The name of the artifact we will be building
const buildName = 'test-artifact'

// Configuration settings for electron-packager
const opts = {
  // We are only building the architecture for the current platform
  arch: process.arch,
  // We want to build the entire project directory
  dir: path.join(__dirname, '..'),
  // And we want to build this for the OS we are currently running
  platform: process.platform,
  // The directory to drop the builds in
  out: outDir,
  // Give it a meaningful name in the event we fail to cleanup
  name: buildName,
  // Overwrite a previous artifact if necessary
  overwrite: true,
  // Use a temporary directory to build the project
  tmpdir: path.join(__dirname, '..', 'build'),
  // Give it a version to skip looking up the package.json, this avoids an
  // error condition we were reaching in the electron-packager module
  version: packageJson.devDependencies['electron-prebuilt'],
  // Only install production deps in our artifact
  prune: 'true',
  // Don't include files from the build process in the artifact
  ignore: [
    /build/,
    /output/
  ]
}

/* Done defining globals */

// Once all of the tests have been run or the process aborts, we want to delete
// the built binary since it was only for these tests
process.on('exit', function cleanupBuild () {
  // Disable globbing ensures that outDir doesn't delete more than one folder
  // NOTE: We are in the `exit` event handler, yielding the event loop here
  // causes the process to exit, so we use the sync version of rimraf
  // return rimraf.sync(outDir, { glob: false })
})

module.exports.getPath = function getPath (cb) {
  // If we have already built a binary, simply return the cached path
  if (cachedBuild) return cb(null, cachedBuild)

  // If a binary has not yet been built for this set of tests, delete the
  // current output directory if it exists, recreate it, and build a fresh
  // binary.
  return rimraf(outDir, function removeDirectory (rimrafError) {
    // If we fail to delete the directory, we can't recreate and build it so
    // there is nothing left for our tests to do. Report the error and crash.
    // Yes, throwing is an anti-pattern, but these are tests so it shouldn't
    // matter. Note: The callback is error first, even though we never return
    // an error. This is only for convention, since it doesn't make sense for
    // the process to continue when an error condition is encountered in this
    // method
    if (rimrafError) throw rimrafError
    mkdirp(outDir, function directoryExists (mkdirpError) {
      // If we fail to create the output directory, we can't build the binary and
      // there is nothing for our tests to do. Yes throwing is an anti-pattern,
      // but these are tests so it shouldn't matter.
      if (mkdirpError) throw mkdirpError

      // We now invoke electron-packager and let it build us a binary to test
      electronPackager(opts, function binaryBuilt (buildError, paths) {
        // If the package failed to build, there is nothing left for us to do
        if (buildError) throw buildError

        // If we have more than one binary built, our assumptions about the
        // options object are wrong and this module needs to be redesigned
        if (paths.length !== 1) {
          throw new Error(`electron-packager built ${paths.length} binaries`)
        }

        // Cache the path to our new binary based on the OS we are running
        switch (os.platform()) {
          case 'darwin':
            cachedBuild = path.join(paths[0],
              `${buildName}.app`,
              'Contents',
              'MacOS',
              buildName)
            break
          case 'win32':
            cachedBuild = path.join(paths[0], `${buildName}.exe`)
            break
          case 'linux':
            cachedBuild = path.join(paths[0], buildName)
            break
          default:
            // We don't build for this OS
            throw new Error(`Unsupported OS: ${os.platform()}`)
        }

        return cb(null, cachedBuild)
      })
    })
  })
}
