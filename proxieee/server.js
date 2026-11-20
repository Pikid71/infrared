const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const cheerio = require('cheerio');

const app = express();
app.use(cookieParser());

const proxyCache = new Map();
const MAX_PROXY_CACHE_SIZE = 100;
const TARGET_COOKIE = 'proxyv2_target';
const PUBLIC_BASES = ['/p/', '/proxieee/p/'];

function getProxyBase(req) {
  const forwardedPrefix = req.headers['x-forwarded-prefix'];
  if (typeof forwardedPrefix === 'string' && forwardedPrefix.trim()) {
    return `/${forwardedPrefix.trim().replace(/^\/+|\/+$/g, '')}`;
  }

  const originalUrl = req.headers['x-original-uri'] || req.headers['x-forwarded-uri'];
  const candidate = typeof originalUrl === 'string' ? originalUrl : req.originalUrl || req.url;
  const match = candidate.match(/^(.+)?\/(?:proxieee\/)?p\//);
  if (match && candidate.includes('/proxieee/p/')) {
    return '/proxieee';
  }
  return '';
}

function getProxyOrigin(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : req.protocol;
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string'
    ? forwardedHost.split(',')[0].trim()
    : req.headers.host;
  return `${proto || 'http'}://${host}${getProxyBase(req)}`;
}

function parseTarget(value) {
  let target;

  try {
    target = new URL(value);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    return null;
  }

  return target;
}

function rewriteLocation(location, targetOrigin, proxyOrigin) {
  try {
    const url = new URL(location, targetOrigin);
    return `${proxyOrigin}/p/${encodeURIComponent(url.href)}`;
  } catch {
    return location;
  }
}

function rewriteCookie(cookie, targetOrigin, proxyProtocol) {
  const rewritten = cookie.replace(/;\s*Domain=[^;]+/i, '');

  return proxyProtocol === 'http:'
    ? rewritten.replace(/;\s*Secure/gi, '')
    : rewritten;
}

function proxyUrl(value, currentUrl, proxyOrigin) {
  if (!value || /^[\s]*(?:javascript|mailto|tel|data|blob):/i.test(value)) {
    return value;
  }
  if (value.startsWith('#')) {
    return value;
  }

  try {
    const url = new URL(value, currentUrl);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
      return value;
    }
    return `${proxyOrigin}/p/${encodeURIComponent(url.href)}`;
  } catch {
    return value;
  }
}

function rewriteCss(body, currentUrl, proxyOrigin) {
  let rewritten = body.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (full, quote, value) => {
    const trimmed = value.trim();
    if (/^(?:data|blob):/i.test(trimmed) || trimmed.startsWith('#')) {
      return full;
    }
    return `url(${quote}${proxyUrl(trimmed, currentUrl, proxyOrigin)}${quote})`;
  });

  rewritten = rewritten.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1(?:\s*\))?/gi,
    (full, quote, value) => {
      const trimmed = value.trim();
      if (/^(?:data|blob):/i.test(trimmed) || trimmed.startsWith('#')) {
        return full;
      }
      return `@import url("${proxyUrl(trimmed, currentUrl, proxyOrigin)}")`;
    });

  return rewritten;
}

function rewriteHtml(body, currentUrl, proxyOrigin) {
  const $ = cheerio.load(body);

  $('[href], [src], [action], [formaction], [poster], [data]').each((_, element) => {
    for (const attribute of ['href', 'src', 'action', 'formaction', 'poster', 'data']) {
      const value = $(element).attr(attribute);
      if (value) {
        $(element).attr(attribute, proxyUrl(value, currentUrl, proxyOrigin));
      }
    }
  });

  $('[srcset]').each((_, element) => {
    const value = $(element).attr('srcset');
    if (!value) return;
    $(element).attr('srcset', value.split(',').map(candidate => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts[0]) return candidate;
      parts[0] = proxyUrl(parts[0], currentUrl, proxyOrigin);
      return parts.join(' ');
    }).join(', '));
  });

  $('style').each((_, element) => {
    $(element).html(rewriteCss($(element).html() || '', currentUrl, proxyOrigin));
  });

  $('script:not([src])').each((_, element) => {
    let script = $(element).html() || '';
    script = script.replace(/(["'])(https?:\/\/[^"'\\]+)\1/g, (full, quote, url) => {
      return `${quote}${proxyUrl(url, currentUrl, proxyOrigin)}${quote}`;
    });
    $(element).html(script);
  });

  $('meta[http-equiv="refresh" i]').each((_, element) => {
    const content = $(element).attr('content');
    const match = content && content.match(/^\s*\d+\s*;\s*url\s*=([\s\S]+)$/i);
    if (match) {
      $(element).attr('content', `0;url=${proxyUrl(match[1].trim().replace(/^['"]|['"]$/g, ''), currentUrl, proxyOrigin)}`);
    }
  });

  $('head').prepend(`<script>
(() => {
  const proxyOrigin = ${JSON.stringify(proxyOrigin)};
  const proxyUrl = (value) => {
    if (!value || /^(?:javascript|mailto|tel|data|blob):/i.test(value) || value.startsWith('#')) return value;
    try {
      const url = new URL(value, ${JSON.stringify(currentUrl)});
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return value;
      return proxyOrigin + '/p/' + encodeURIComponent(url.href);
    } catch { return value; }
  };
  window.__proxyUrl = proxyUrl;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' || input instanceof URL) {
      input = proxyUrl(input.toString());
    } else if (input instanceof Request) {
      input = new Request(proxyUrl(input.url), input);
    }
    return originalFetch(input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, proxyUrl(url.toString()), ...rest);
  };

  window.open = ((originalOpenWindow) => (url, target, features) =>
    originalOpenWindow(proxyUrl(url), target, features))(window.open);

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const rewritten = proxyUrl(link.getAttribute('href'));
    if (rewritten && rewritten !== link.getAttribute('href')) {
      event.preventDefault();
      location.href = rewritten;
    }
  }, true);

  const sendAddress = () => {
    let url = ${JSON.stringify(currentUrl)};
    const marker = '/p/';
    const markerIndex = location.pathname.indexOf(marker);
    if (markerIndex !== -1) {
      try { url = decodeURIComponent(location.pathname.slice(markerIndex + marker.length)); } catch {}
    }
    parent.postMessage({ type: 'proxieee-location', url }, '*');
  };
  sendAddress();
  window.addEventListener('popstate', sendAddress);
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method].bind(history);
    history[method] = (...args) => {
      const result = original(...args);
      sendAddress();
      return result;
    };
  }
})();
</script>`);

  return $.html();
}

function getProxy(targetOrigin) {
  if (proxyCache.has(targetOrigin)) {
    return proxyCache.get(targetOrigin);
  }

  const proxy = createProxyMiddleware({
    target: targetOrigin,
    changeOrigin: true,
    selfHandleResponse: true,
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
        const proxyHost = getProxyOrigin(req);
        const currentUrl = req.proxyTargetUrl || new URL(
          req.url,
          targetOrigin
        ).href;

        // Strip headers that block proxies
        for (const header of [
          'content-security-policy',
          'content-security-policy-report-only',
          'x-frame-options',
          'cross-origin-opener-policy',
          'cross-origin-resource-policy',
        ]) {
          delete proxyRes.headers[header];
          res.removeHeader(header);
        }
        res.removeHeader('permissions-policy');

        // Rewrite redirects so they stay inside the proxy
        if (proxyRes.headers['location']) {
          const location = rewriteLocation(
            proxyRes.headers['location'],
            targetOrigin,
            proxyHost
          );
          proxyRes.headers['location'] = location;
          res.setHeader('location', location);
        }

        if (proxyRes.headers['set-cookie']) {
          const cookies = proxyRes.headers['set-cookie'].map(cookie =>
            rewriteCookie(cookie, targetOrigin, new URL(proxyHost).protocol)
          );
          proxyRes.headers['set-cookie'] = cookies;
          res.setHeader('set-cookie', cookies);
        }

        // Rewrite absolute links inside HTML and CSS
        const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
        if (
          contentType.includes('text/html') ||
          contentType.includes('text/css') ||
          contentType.includes('application/css') ||
          contentType.includes('application/x-css')
        ) {
          let body = responseBuffer.toString('utf8');
          if (contentType.includes('text/html')) {
            body = rewriteHtml(body, currentUrl, proxyHost);
          } else {
            body = rewriteCss(body, currentUrl, proxyHost);
          }
          delete proxyRes.headers['content-length'];
          res.removeHeader('content-length');
          return body;
        }

        if (contentType.includes('javascript') || contentType.includes('ecmascript')) {
          let body = responseBuffer.toString('utf8');
          body = `(function(){const proxyOrigin=${JSON.stringify(proxyHost)};const currentUrl=${JSON.stringify(currentUrl)};const proxyUrl=(value)=>{if(!value||/^(?:javascript|mailto|tel|data|blob):/i.test(value)||value.startsWith('#'))return value;try{const url=new URL(value,currentUrl);if(!['http:','https:','ws:','wss:'].includes(url.protocol))return value;return proxyOrigin+'/p/'+encodeURIComponent(url.href)}catch{return value}};if(window.fetch){const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{if(typeof input==='string'||input instanceof URL)input=proxyUrl(input.toString());else if(input instanceof Request)input=new Request(proxyUrl(input.url),input);return originalFetch(input,init)}}if(window.XMLHttpRequest){const open=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){return open.call(this,method,proxyUrl(url.toString()),...rest)}}})();\n` + body;
          delete proxyRes.headers['content-length'];
          res.removeHeader('content-length');
          return body;
        }

        return responseBuffer;
      }),
      error: (err, req, res) => {
        console.error('Proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).send('Bad Gateway: Could not connect to host server.');
        }
      },
    },
  });

  if (proxyCache.size >= MAX_PROXY_CACHE_SIZE) {
    proxyCache.delete(proxyCache.keys().next().value);
  }
  proxyCache.set(targetOrigin, proxy);
  return proxy;
}

// Reset route: clears the active proxy session and returns to index.html
app.get('/home', (req, res) => {
  res.clearCookie(TARGET_COOKIE, { path: '/' });
  res.redirect('/');
});

// Initial proxy route: connects directly to the target URL
app.all(['/p/:url', '/proxieee/p/:url'], (req, res, next) => {
  try {
    const targetUrl = parseTarget(decodeURIComponent(req.params.url));
    if (!targetUrl) {
      return res.status(400).send('Invalid URL. Use an http:// or https:// URL without credentials.');
    }

    res.cookie(TARGET_COOKIE, targetUrl.origin, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
    req.proxyTargetUrl = targetUrl.href;
    req.url = targetUrl.pathname + targetUrl.search;

    return getProxy(targetUrl.origin)(req, res, next);
  } catch (err) {
    res.status(400).send('Invalid URL. Use an http:// or https:// URL without credentials.');
  }
});

app.get(['/', '/proxieee', '/proxieee/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all: proxies active sessions, or serves /public/index.html if no session is active
app.use('/', (req, res, next) => {
  const targetOrigin = parseTarget(req.cookies[TARGET_COOKIE])?.origin;

  // If no site is currently loaded, serve the browser start page
  if (!targetOrigin) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  req.proxyTargetUrl = new URL(req.url, targetOrigin).href;
  return getProxy(targetOrigin)(req, res, next);
});

app.use((err, req, res, next) => {
  console.error('Proxy request failed:', err);
  if (!res.headersSent) {
    res.status(502).send('Bad Gateway: The host server returned an invalid response.');
  } else {
    next(err);
  }
});

app.listen(process.env.PORT || 8000, () => {
  console.log(`Live proxy browser running on port ${process.env.PORT || 8000}`);
});