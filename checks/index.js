const http = require('./http');
const network = require('./network');
const protocol = require('./protocol');
const playwright = require('./playwright');

async function run(monitor) {
  switch (monitor.type) {
    case 'url-unavailable':
    case 'url-no-keyword':
    case 'url-has-keyword':
    case 'url-non-200':
      return http.run(monitor);

    case 'ping-no-response':
    case 'tcp-no-response':
    case 'udp-no-response':
      return network.run(monitor);

    case 'smtp-no-response':
    case 'pop3-no-response':
    case 'imap-no-response':
    case 'dns-no-response':
      return protocol.run(monitor);

    case 'playwright-fails':
      return playwright.run(monitor);

    default:
      return { status: 'down', message: `Unknown check type: ${monitor.type}` };
  }
}

module.exports = { run };
