const http = require('http');
const https = require('https');
const { URL } = require('url');

function fetch(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

async function run(monitor) {
  try {
    const result = await fetch(monitor.target);

    switch (monitor.type) {
      case 'url-unavailable':
        return { status: 'up', message: 'Available' };

      case 'url-non-200':
        if (result.status === 200) {
          return { status: 'up', message: `HTTP ${result.status}` };
        }
        return { status: 'down', message: `HTTP ${result.status}` };

      case 'url-no-keyword':
        if (result.body.includes(monitor.expected)) {
          return { status: 'up', message: 'Keyword found' };
        }
        return { status: 'down', message: 'Keyword not found' };

      case 'url-has-keyword':
        if (result.body.includes(monitor.expected)) {
          return { status: 'down', message: 'Unexpected keyword found' };
        }
        return { status: 'up', message: 'Keyword absent' };

      default:
        return { status: 'down', message: `Unknown type: ${monitor.type}` };
    }
  } catch (err) {
    if (monitor.type === 'url-unavailable') {
      return { status: 'down', message: err.message };
    }
    return { status: 'down', message: err.message };
  }
}

module.exports = { run };
