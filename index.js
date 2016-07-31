/* Configuration:
 *
 * config.protocol: defines the name of the protocol that will serve static
 *   websites over torrent. For example, if you set this to 'peer', then any
 *   url prefixed with 'peer://' will be handled by our torrent protocol
 *
*/
const config = require('./config.json')
require('electron-debug')({ showDevTools: true })

/* Begin Dependencies */

// We use path to locate files on the local filesystem
const path = require('path')

// We use url to parse incomming requests for their file path
const url = require('url')

// Electron is used to render a browser for the user
const electron = require('electron') // eslint-disable-line import/no-unresolved

// IPC is used to convey torrent information to rendering process
const ipcMain = electron.ipcMain

// WebTorrent gives our application the ability to download/seed torrents
const WebTorrent = require('webtorrent')

// prettier-bytes takes download/upload rates and makes them human friendly
const pbytes = require('prettier-bytes')

// parse-torrent lets us verify a torrent hash before passing it onto the
// webtorrent handler
const parseTorrent = require('parse-torrent')

// request will be used for the http fallback when parse-torrent says a request
// was not in the form of a torrent info
const request = require('request')

// temp will allow us to save html files fetched over the http fallback and
// they will be purged on application shutdown
const temp = require('temp')
temp.track()

// fs will allow us to write to our temporary file
const fs = require('fs')

/* End Dependencies */

// Create a new client responsible for seeding/downloading torrents
const client = new WebTorrent()

// ipc Global Status channel , only for recieving Stat requests
// Reply sent on : global-status-reply
ipcMain.on('global-status', function updateStatus (event, arg) {
  // status contains WebTorrent Client Stats
  const status = {
    download: pbytes(client.downloadSpeed),
    upload: pbytes(client.uploadSpeed),
    torrents: client.torrents
  }
  // Send Asynchronous reply. Note that status is serialized internally
  event.sender.send('global-status-reply', status)
})

// peerProtocolHandler resolves a peer:// request against a torrent, returning
// the requested file as the result
function peerProtocolHandler (req, callback) {
  // Take the incomming request and parse out the url components
  let requestedUrl = url.parse(req.url)

  // If the requested file has a trailing `/`, assume it is a folder and add
  // index.html to the end
  let requestedFile = requestedUrl.pathname

  if (requestedFile.substring(requestedFile.length - 1) === '/') {
    requestedFile += 'index.html'
  }

  // Make sure the path isn't prefixed with a slash
  if (requestedFile.substring(0, 1) === '/') {
    requestedFile = requestedFile.substring(1)
  }

  // Log the requested file
  console.log(requestedFile) // eslint-disable-line no-console

  // The hash is the hostname of the requested url
  const hash = requestedUrl.host

  // We create a directory using the torrent's hash and have webtorrent
  // download the website's contents there
  const opts = {
    path: path.join(__dirname, 'downloads', hash)
  }

  // Ensure the torrent hash is valid before we pass it on to webtorrent, if it
  // is not, try fetching it over http
  try {
    parseTorrent(hash)
  } catch (exception) {
    // eslint-disable-next-line no-console
    console.log('Not a torent identifier, falling back to http')
    requestedUrl.protocol = 'http'
    requestedUrl = url.format(requestedUrl)
    return request(requestedUrl, function httpFallback (e, resp, body) {
      // If we didn't get a 200 response, return an error
      if (e) {
        // eslint-disable-next-line no-console
        console.log(`Failed to fetch ${requestedUrl}: ${e}`)
        return callback(e)
      } else if (resp.statusCode !== 200) {
        // eslint-disable-next-line no-console
        console.log(`Failed to fetch ${requestedUrl}: ${resp.statusCode}`)
        return callback(resp.statusCode)
      }

      // Create a temporary file for our downloaded resource
      return temp.open('peerwebhttp', function tempFileOpened (e2, info) {
        if (e2) {
          // eslint-disable-next-line no-console
          console.log(`Failed to open temp file: ${e2}`)
          return callback(e2)
        }

        // We then write our response to the temporary file and return the path
        // back to electron to serve as the response
        return fs.write(info.fd, body, function tempFileWritten () {
          fs.close(info.fd, function tempFileClosed () {
            return callback(info.path)
          })
        })
      })
    })
  }

  // Lets kick off the download through webtorrent
  return client.add(hash, opts, function loaded (torrent) {
    // Search the torrent for the requestedFile
    let returnFile = null
    for (let i = 0; i < torrent.files.length; i++) {
      const file = torrent.files[i]
      // Webtorrent prepends the torrent name to the beginning of the file,
      // we want to remove that when searching for the requested file
      const name = file.path.substring((`${torrent.name}/`).length)
      if (name === requestedFile) {
        // found it!
        returnFile = file
      }
    }

    // If the requested file was not found, try assuming it is a directory and
    // look for index.html in that directory
    if (returnFile == null) {
      // eslint-disable-next-line no-console
      console.log(`Trying ${requestedFile}/index.html`)
      for (let i = 0; i < torrent.files.length; i++) {
        const file = torrent.files[i]
        // Webtorrent prepends the torrent name to the beginning of the file,
        // we want to remove that when searching for the requested file
        const name = file.path.substring((`${torrent.name}/`).length)
        if (name === `${requestedFile}/index.html`) {
          // found it!
          returnFile = file
        }
      }
    }

    // If the requested file wasn't a folder, try checking if there is a file
    // by the name of requestedFile.html in the torrent
    if (returnFile == null) {
      // eslint-disable-next-line no-console
      console.log(`Trying ${requestedFile}.html`)
      for (let i = 0; i < torrent.files.length; i++) {
        const file = torrent.files[i]
        // Webtorrent prepends the torrent name to the beginning of the file,
        // we want to remove that when searching for the requested file
        const name = file.path.substring((`${torrent.name}/`).length)
        if (name === `${requestedFile}.html`) {
          // found it!
          returnFile = file
        }
      }
    }

    // If it is still not found, tell electron we didn't find the file
    if (returnFile == null) {
      // eslint-disable-next-line no-console
      console.log(`${requestedFile} not found, returning null`)
      return callback(404)
    }

    // Wait for the file to become available, downloading from the network at
    // highest priority. This ensures we don't return a path to a file that
    // hasn't finished downloading yet.
    return returnFile.getBuffer(function getBuffer (e) {
      // We don't actually care about the buffer, we only care if the file
      // was downloaded
      if (e) return callback(e)
      // Generate the path to the file on the local fs
      const file = path.join(__dirname, 'downloads', hash, returnFile.path)

      // Give the file back to electron
      console.log(`Returning: ${file}`)// eslint-disable-line no-console
      return callback({ path: file })
    })
  })
}

// registerTorrentProtocol takes an instance of electron and registers a
// handler for our new protocol, allowing the instance of electron to resolve
// requests against a torrent
function registerTorrentProtocol (localElectron, cb) {
  localElectron
    .protocol
    .registerFileProtocol(config.protocol, peerProtocolHandler,
                          function registeredProtocol (e) {
                            if (e) {
                              return cb(e)
                            }
                            // Don't treat our new protocol like http
                            electron.protocol.registerStandardSchemes([config.protocol])
                            // Done setting up our new protocol
                            return cb()
                          })
}

// configureElectron registers the custom protocol with or electron app
function configureElectron () {
  // electron is now ready to be configured
  registerTorrentProtocol(electron, function init2 (e) {
    if (e) {
      throw e
    }

    // peer:// protocol has been registered
    const opts = {}

    // Start the application
    const mainWindow = new electron.BrowserWindow(opts)

    // Hide the menubar
    mainWindow.setMenu(null)

    // Load the UI
    mainWindow.loadURL(`file://${path.join(__dirname, 'ui', 'index.html')}`)
  })
}

// The main logic of our application. This is what runs when called directly
// from the command line
function applicationLogic () {
  electron.app.on('ready', configureElectron)
}

// Kick off the application
applicationLogic()
