(function () {
  if (window.__YSB_HELPER_PAGE_HOOK__) return;
  window.__YSB_HELPER_PAGE_HOOK__ = true;

  const SOURCE = "YSB_HELPER_PAGE_HOOK";
  const WHOLESALE_LIST_RE = /\/wholesale-drug\/sales\/getWholesaleList\/v4270(?:\?|$)/;
  const PRODUCT_VALUE_RE = /￥|元|盒|瓶|袋|片|粒|胶囊|颗粒|药|有效期|厂家|包邮/i;
  const originalJsonParse = JSON.parse;
  const MAX_ARRAYS = 12;
  const MAX_ARRAY_ITEMS = 120;
  const MAX_SAMPLE_ITEMS = 5;
  const recentRequests = [];

  function normalizeUrl(url) {
    if (!url) return "";
    try {
      return new URL(url, location.origin).href;
    } catch {
      return String(url);
    }
  }

  function rememberRequest(details) {
    const url = normalizeUrl(details && details.url);
    if (!url || !WHOLESALE_LIST_RE.test(url)) return;
    recentRequests.unshift({
      at: Date.now(),
      url,
      method: details.method || "",
      status: details.status || 0
    });
    recentRequests.length = Math.min(recentRequests.length, 10);
  }

  function getRecentWholesaleRequest() {
    const now = Date.now();
    return recentRequests.find((request) => now - request.at < 15000) || null;
  }

  function scoreProductObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
    const keys = Object.keys(value);
    if (!keys.length) return 0;

    const keyText = keys.join("|");
    const hasIdentitySignal = /drug|goods|product|sku|medicine|wholesale|provider|factory|manufacturer|spec|name|title|商品|药品|厂家|规格/i.test(keyText);
    const hasCommerceSignal = /price|amount|sale|cost|retail|valid|expire|stock|purchase|limit|quantity|qty|minBuy|起购|限购|有效期|价格|库存/i.test(keyText);
    if (!hasIdentitySignal || !hasCommerceSignal) return 0;

    let score = 0;
    if (/drug|goods|product|sku|medicine|wholesale/i.test(keyText)) score += 3;
    if (/provider|factory|manufacturer|supplier|seller/i.test(keyText)) score += 2;
    if (/price|amount|sale|cost|retail/i.test(keyText)) score += 2;
    if (/spec|standard|valid|expire|stock|purchase|limit|quantity/i.test(keyText)) score += 1;
    if (/name|title/i.test(keyText)) score += 1;
    if (/商品|药品|厂家|价格|规格|库存|有效期/i.test(keyText)) score += 3;

    try {
      const sample = JSON.stringify(value).slice(0, 1600);
      if (PRODUCT_VALUE_RE.test(sample)) score += 2;
    } catch {
      // Ignore circular or inaccessible values.
    }

    return score;
  }

  function sanitizeValue(value, depth, seen) {
    if (value === null || typeof value === "undefined") return value;
    if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}...` : value;
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (depth <= 0) return Array.isArray(value) ? "[Array]" : "[Object]";
    if (typeof value !== "object") return String(value);
    if (seen.indexOf(value) !== -1) return "[Circular]";
    seen.push(value);

    if (Array.isArray(value)) {
      return value.slice(0, 30).map((item) => sanitizeValue(item, depth - 1, seen));
    }

    const output = {};
    Object.keys(value)
      .slice(0, 80)
      .forEach((key) => {
        try {
          output[key] = sanitizeValue(value[key], depth - 1, seen);
        } catch {
          output[key] = "[Unreadable]";
        }
      });
    return output;
  }

  function findProductArrays(root) {
    const hits = [];
    const seen = [];

    function hasSeen(value) {
      return seen.indexOf(value) !== -1;
    }

    function walk(value, path, depth) {
      if (!value || typeof value !== "object" || depth > 7 || hits.length >= MAX_ARRAYS) return;
      if (hasSeen(value)) return;
      seen.push(value);

      if (Array.isArray(value)) {
        const objectItems = value.filter((item) => item && typeof item === "object");
        const scoredItems = objectItems
          .map((item) => ({ item, score: scoreProductObject(item) }))
          .filter((entry) => entry.score >= 4);
        const productItems = scoredItems.map((entry) => entry.item);
        if (productItems.length) {
          const score = scoredItems.reduce((total, entry) => total + entry.score, 0);
          hits.push({
            path,
            length: value.length,
            matchedLength: productItems.length,
            score,
            keys: Object.keys(productItems[0]).slice(0, 40),
            sample: productItems.slice(0, MAX_SAMPLE_ITEMS).map((item) => sanitizeValue(item, 3, [])),
            items: productItems.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, 4, []))
          });
        }
        value.slice(0, 30).forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
        return;
      }

      Object.keys(value).slice(0, 80).forEach((key) => {
        if (hits.length >= MAX_ARRAYS) return;
        const nextPath = path ? `${path}.${key}` : key;
        try {
          walk(value[key], nextPath, depth + 1);
        } catch {
          // Ignore inaccessible properties from app internals.
        }
      });
    }

    walk(root, "response", 0);
    return hits;
  }

  function collectResponseMeta(root) {
    const aliases = {
      totalProducts: /^(total|totalNumber|totalCount|count|totalNum|recordCount|recordsTotal)$/i,
      page: /^(page|pageNo|pageNum|currentPage)$/i,
      totalPages: /^(totalPage|totalPages|pages)$/i,
      pageSize: /^(pageSize|pagesize|size)$/i,
      nextRequestKey: /^nextRequestKey$/i
    };
    const output = {};
    const seen = [];

    function walk(value, depth) {
      if (!value || typeof value !== "object" || depth > 5) return;
      if (seen.indexOf(value) !== -1) return;
      seen.push(value);

      if (Array.isArray(value)) {
        value.slice(0, 20).forEach((item) => walk(item, depth + 1));
        return;
      }

      Object.keys(value).slice(0, 80).forEach((key) => {
        const field = Object.keys(aliases).find((name) => aliases[name].test(key));
        if (field && typeof output[field] === "undefined") {
          const raw = value[key];
          output[field] = typeof raw === "number" || typeof raw === "string" ? raw : "";
        }
      });

      Object.keys(value)
        .slice(0, 40)
        .forEach((key) => {
          try {
            walk(value[key], depth + 1);
          } catch {
            // Ignore inaccessible values.
          }
        });
    }

    walk(root, 0);
    return output;
  }

  function publishParsedProducts(root, source) {
    const arrays = findProductArrays(root);
    if (!arrays.length) return;

    const request = getRecentWholesaleRequest();
    if (source === "json-parse" && !request) return;
    window.postMessage(
      {
        source: SOURCE,
        type: "parsed-products",
        at: new Date().toISOString(),
        parseSource: source || "json-parse",
        endpointHint: request,
        meta: collectResponseMeta(root),
        arrays
      },
      "*"
    );
  }

  JSON.parse = function ysbHelperJsonParse(text, reviver) {
    const result = originalJsonParse.apply(this, arguments);
    try {
      if (typeof text === "string" && text.length > 200) {
        publishParsedProducts(result, "json-parse");
      }
    } catch {
      // JSON.parse must remain behaviorally identical to the native function.
    }
    return result;
  };

  try {
    JSON.parse.toString = originalJsonParse.toString.bind(originalJsonParse);
  } catch {
    // Non-critical stealth compatibility.
  }

  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = function ysbHelperFetch(input, init) {
      const method = (init && init.method) || (input && input.method) || "GET";
      const url = typeof input === "string" ? input : input && input.url;
      rememberRequest({ url, method });
      return originalFetch.apply(this, arguments);
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  if (OriginalXHR) {
    const originalOpen = OriginalXHR.prototype.open;

    OriginalXHR.prototype.open = function ysbHelperOpen(method, url) {
      this.__ysbHelperRequest = { method, url };
      rememberRequest({ method, url });
      return originalOpen.apply(this, arguments);
    };
  }
})();
