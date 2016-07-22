/*
 * search.js
 *
 * This file contains all of the code immediately relevant to the search bar
 * at the top of the page. The search bar is an overloaded term, its really
 * just the bar you type URLs into for navigation. It currently offers no
 * search.
 */

// Create a global singleton that scopes the globally exposed functions from
// this application
// eslint-disable-next-line prefer-const, no-use-before-define, no-var
var peerWeb = peerWeb || {}
// eslint-disable-next-line prefer-const, no-use-before-define, no-var
var url = require('url')

// Scope all functions exposed by this file to search
peerWeb.search = peerWeb.search || {}

;(function scope () {
  // Scrub the url to make it electron friendly
  peerWeb.search.scrubUrl = function scrubUrl (addr) {
    if (url.parse(addr).path == null) {
      return `${addr}/`
    }
    return addr
  }

  // checkSubmit is an event listener for the search bar in the UI. It waits
  // until a user presses enter and then sends the user to the URL typed into
  // the search bar
  peerWeb.search.checkSubmit = function checkSubmit (e) {
    // If event is defined and the keyCode of the event is the enter key, go
    // ahead and try to send the user to the url they typed in
    if (e != null && e.keyCode === 13) {
      const addr = peerWeb.search.scrubUrl(e.target.value)
      document.getElementById('search-bar').value = addr
      peerWeb.ui.navigate(addr)
    }
  }

  // navigateBack will send the currently selected webview to it's previous
  // page if possible
  peerWeb.search.back = function navigateBack (e) {
    // Iterate through all webviews looking for the selected one
    const webviews = document.getElementsByTagName('webview')
    let webview = webviews[0]

    for (let i = 0;
          i < webviews.length && !peerWeb.utils.hasClass(webview, 'selected');
          i++, webview = webviews[i]) {} // eslint-disable-line no-empty

    // If we didn't find a selected webview, then we have nothing to do
    if (webview == null || !peerWeb.utils.hasClass(webview, 'selected')) {
      return null
    }

    // If we can't navigate backwards, there is nothing to do
    if (!webview.canGoBack()) {
      return null
    }

    // Navigate back a page
    webview.goBack()

    // If we can't go back any further, reflect that in the UI
    if (!webview.canGoBack()) {
      const navBack = document.getElementById('search-back')
      navBack.className = peerWeb.utils.removeClass(navBack, 'inactive')
      navBack.className = peerWeb.utils.addClass(navBack, 'inactive')
    }

    return null
  }

  // navigateForward will send the currently selected webview to it's next
  // page if possible
  peerWeb.search.forward = function navigateForward (e) {
    // Iterate through all webviews looking for the selected one
    const webviews = document.getElementsByTagName('webview')
    let webview = webviews[0]

    for (let i = 0;
        i < webviews.length && !peerWeb.utils.hasClass(webview, 'selected');
        i++, webview = webviews[i]) {} // eslint-disable-line no-empty

    // If we didn't find a selected webview, then we have nothing to do
    if (webview == null || !peerWeb.utils.hasClass(webview, 'selected')) {
      return null
    }

    // If we can't navigate forwards, there is nothing to do
    if (!webview.canGoForward()) {
      return null
    }

    // Navigate forward a page
    webview.goForward()

    // If we can't go forward any further, reflect that in the UI
    if (!webview.canGoForward()) {
      const navForward = document.getElementById('search-forward')
      navForward.className = peerWeb.utils.removeClass(navForward, 'inactive')
      navForward.className = peerWeb.utils.addClass(navForward, 'inactive')
    }

    return null
  }

  // refresh will refresh the webview's current page
  peerWeb.search.refresh = function refresh (e) {
    // Iterate through all webviews looking for the selected one
    const webviews = document.getElementsByTagName('webview')
    let webview = webviews[0]

    for (let i = 0;
        i < webviews.length && !peerWeb.utils.hasClass(webview, 'selected');
        i++, webview = webviews[i]) {} // eslint-disable-line no-empty

    // If we didn't find a selected webview, then we have nothing to do
    if (webview == null || !peerWeb.utils.hasClass(webview, 'selected')) {
      return null
    }

    // refresh a page
    webview.reload()

    return null
  }
})()
