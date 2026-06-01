(function () {
  if (window.__YSB_HELPER_CONTENT__) return;
  window.__YSB_HELPER_CONTENT__ = true;

  const SOURCE = "YSB_HELPER_PAGE_HOOK";
  const TARGET_ORIGIN = "https://dian.ysbang.cn";
  const TARGET_HASH_PATH = "#/indexContent";
  const CSV_COLUMNS = [
    ["price", "单价"],
    ["stockText", "库存"],
    ["name", "品名"],
    ["spec", "规格"],
    ["seller", "商家"],
    ["validUntil", "有效期"],
    ["freeShipping", "包邮"],
    ["traceable", "追溯码"],
    ["scanRequired", "出库扫码"],
    ["purchasedBefore", "买过的店"],
    ["purchaseLimit", "限购"],
    ["tags", "标签"],
    ["url", "来源"]
  ];
  const apiState = {
    lastSignature: "",
    lastSnapshot: null,
    apiProducts: [],
    apiMeta: null,
    apiSourceUrl: ""
  };
  const uiState = {
    host: null,
    root: null,
    minimized: false,
    snapshot: null,
    filtered: [],
    filters: {
      keyword: "",
      freeShippingOnly: false,
      traceableOnly: false,
      purchasedOnly: false
    }
  };

  function cleanText(value) {
    if (value === null || typeof value === "undefined") return "";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    const match = cleanText(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function normalizeKey(key) {
    return String(key || "").replace(/[_\-\s]/g, "").toLowerCase();
  }

  function getField(source, aliases) {
    if (!source || typeof source !== "object") return "";
    const wanted = aliases.map(normalizeKey);
    const directKeys = Object.keys(source);

    for (const key of directKeys) {
      if (wanted.includes(normalizeKey(key))) return source[key];
    }

    for (const key of directKeys) {
      const value = source[key];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const nested = getField(value, aliases);
      if (nested !== "" && typeof nested !== "undefined" && nested !== null) return nested;
    }

    return "";
  }

  function valueText(value) {
    if (Array.isArray(value)) {
      return value.map((item) => valueText(item)).filter(Boolean).join(" ");
    }
    if (value && typeof value === "object") {
      const compact = value.name || value.label || value.title || value.value || value.id || value.code || "";
      if (compact !== "") return cleanText(compact);
      try {
        return cleanText(JSON.stringify(value));
      } catch {
        return "";
      }
    }
    return cleanText(value);
  }

  function textField(source, aliases) {
    const value = getField(source, aliases);
    return valueText(value);
  }

  function numberField(source, aliases) {
    const value = getField(source, aliases);
    if (typeof value === "number") return value;
    return parseNumber(value);
  }

  function parseSearchParams(url) {
    try {
      const parsed = new URL(url);
      const hashQuery = parsed.hash.includes("?") ? parsed.hash.split("?")[1] : "";
      return new URLSearchParams(hashQuery || parsed.search.replace(/^\?/, ""));
    } catch {
      return new URLSearchParams("");
    }
  }

  function isTargetPage() {
    return window.location.origin === TARGET_ORIGIN && window.location.hash.startsWith(TARGET_HASH_PATH);
  }

  function uniqueList(values) {
    return Array.from(new Set(values.map(cleanText).filter(Boolean)));
  }

  function getPathValue(source, path) {
    return path.reduce((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return current[key];
    }, source);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    if (!Number.isFinite(Number(value))) return "-";
    return `¥${Number(value).toFixed(2)}`;
  }

  function formatTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "-";
    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function csvEscape(value) {
    const text = String(value || "");
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function sanitizeFileName(value) {
    return String(value || "ysb").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60);
  }

  function toCsv(products) {
    const rows = [
      CSV_COLUMNS.map(([, label]) => label),
      ...products.map((item) =>
        CSV_COLUMNS.map(([key]) => {
          const value = item[key];
          if (Array.isArray(value)) return value.join(" ");
          if (typeof value === "boolean") return value ? "是" : "否";
          if (value === null || typeof value === "undefined") return "";
          return String(value);
        })
      )
    ];
    return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
  }

  function toJson(snapshot, products) {
    return JSON.stringify(
      {
        source: snapshot.source || "",
        reason: snapshot.reason || "",
        url: snapshot.url || "",
        title: snapshot.title || "",
        searchKey: snapshot.searchKey || "",
        capturedAt: snapshot.capturedAt || "",
        totalProducts: snapshot.totalProducts || products.length || 0,
        currentPageCount: snapshot.currentPageCount || products.length || 0,
        filteredCount: products.length,
        sellerCount: snapshot.sellerCount || 0,
        lowestPrice: snapshot.lowestPrice || null,
        products
      },
      null,
      2
    );
  }

  function downloadText(text, filename, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyText(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function button(label, action, extraClass) {
    return `<button type="button" data-action="${action}" class="ysb-helper-btn ${extraClass || ""}">${escapeHtml(label)}</button>`;
  }

  function renderTags(tags) {
    if (!tags || !tags.length) return "";
    return `<div class="ysb-helper-tags">${tags
      .slice(0, 5)
      .map((tag) => `<span class="ysb-helper-tag ${/券|补贴|限购/.test(tag) ? "warn" : ""}">${escapeHtml(tag)}</span>`)
      .join("")}</div>`;
  }

  function applyUiFilters(products) {
    const keyword = uiState.filters.keyword.trim().toLowerCase();
    let output = products.slice();

    if (keyword) {
      output = output.filter((item) =>
        [item.name, item.seller, item.sellerRaw, item.manufacturer, item.spec, item.stockText, (item.tags || []).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      );
    }
    if (uiState.filters.freeShippingOnly) output = output.filter((item) => item.freeShipping);
    if (uiState.filters.traceableOnly) output = output.filter((item) => item.traceable);
    if (uiState.filters.purchasedOnly) output = output.filter((item) => item.purchasedBefore);
    return output;
  }

  function ensurePanel() {
    if (uiState.host && document.documentElement.contains(uiState.host)) return;
    uiState.host = document.createElement("div");
    uiState.host.id = "ysb-helper-panel-host";
    uiState.host.style.all = "initial";
    const shadow = uiState.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .ysb-helper-wrap {
        position: fixed;
        top: 86px;
        right: 16px;
        z-index: 2147483647;
        width: 620px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 116px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #d8e0e8;
        border-radius: 8px;
        background: #fff;
        color: #1f2933;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .ysb-helper-wrap.minimized {
        width: 44px;
        height: 132px;
        border-radius: 8px 0 0 8px;
        right: 0;
        cursor: pointer;
      }
      .ysb-helper-min-tab {
        display: none;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        background: #0f766e;
        color: #fff;
        font-weight: 700;
        letter-spacing: 0;
        writing-mode: vertical-rl;
      }
      .ysb-helper-wrap.minimized .ysb-helper-min-tab { display: flex; }
      .ysb-helper-wrap.minimized .ysb-helper-panel { display: none; }
      .ysb-helper-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid #e3e8ef;
        background: #f8fafc;
      }
      .ysb-helper-title { margin: 0; font-size: 15px; font-weight: 700; }
      .ysb-helper-subtitle { margin-top: 2px; color: #6b7280; font-size: 12px; }
      .ysb-helper-icon-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #cfd8e3;
        border-radius: 6px;
        background: #fff;
        color: #344054;
        cursor: pointer;
      }
      .ysb-helper-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-bottom: 1px solid #e3e8ef;
        background: #e3e8ef;
        gap: 1px;
      }
      .ysb-helper-stat { padding: 8px 12px; background: #fff; }
      .ysb-helper-stat span { display: block; color: #6b7280; font-size: 11px; }
      .ysb-helper-stat strong { display: block; margin-top: 1px; font-size: 17px; line-height: 1.15; }
      .ysb-helper-tools {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid #e3e8ef;
      }
      .ysb-helper-search {
        flex: 1;
        min-width: 120px;
        height: 30px;
        padding: 0 9px;
        border: 1px solid #cfd8e3;
        border-radius: 6px;
        outline: none;
        font: inherit;
      }
      .ysb-helper-search:focus { border-color: #0f766e; }
      .ysb-helper-check {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: #6b7280;
        white-space: nowrap;
        font-size: 12px;
      }
      .ysb-helper-actions {
        display: flex;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid #e3e8ef;
      }
      .ysb-helper-btn {
        height: 30px;
        padding: 0 10px;
        border: 1px solid #cfd8e3;
        border-radius: 6px;
        background: #fff;
        color: #1f2933;
        cursor: pointer;
        font: inherit;
      }
      .ysb-helper-btn.primary { border-color: #0f766e; background: #0f766e; color: #fff; }
      .ysb-helper-table-wrap { overflow: auto; max-height: min(440px, calc(100vh - 380px)); }
      table { width: 100%; border-collapse: separate; border-spacing: 0; background: #fff; }
      th, td { padding: 8px 10px; border-bottom: 1px solid #e3e8ef; text-align: left; vertical-align: top; }
      th { position: sticky; top: 0; z-index: 1; background: #eef3f7; color: #344054; font-size: 12px; font-weight: 700; }
      td { color: #26313d; }
      .price, .stock, .date { width: 72px; white-space: nowrap; }
      .name { min-width: 180px; max-width: 240px; }
      .seller { min-width: 100px; max-width: 140px; }
      .muted { color: #6b7280; }
      .ysb-helper-tags { display: flex; flex-wrap: wrap; gap: 4px; min-width: 105px; }
      .ysb-helper-tag { display: inline-flex; align-items: center; height: 20px; padding: 0 6px; border-radius: 4px; background: #eef6f4; color: #115e59; font-size: 12px; white-space: nowrap; }
      .ysb-helper-tag.warn { background: #fff7ed; color: #d97706; }
      .ysb-helper-empty { height: 160px; color: #6b7280; text-align: center; vertical-align: middle; }
      .ysb-helper-footer { padding: 7px 12px; border-top: 1px solid #e3e8ef; background: #f8fafc; color: #6b7280; font-size: 12px; }
    `;
    uiState.root = document.createElement("div");
    shadow.append(style, uiState.root);
    document.documentElement.appendChild(uiState.host);

    uiState.root.addEventListener("click", handlePanelClick);
    uiState.root.addEventListener("input", handlePanelInput);
    uiState.root.addEventListener("change", handlePanelInput);
  }

  function removePanel() {
    if (uiState.host) uiState.host.remove();
    uiState.host = null;
    uiState.root = null;
  }

  function updatePanel() {
    if (!isTargetPage() || !uiState.snapshot || !uiState.snapshot.products.length) {
      removePanel();
      return;
    }

    ensurePanel();
    const snapshot = uiState.snapshot;
    const products = applyUiFilters(snapshot.products || []);
    uiState.filtered = products;
    const query = snapshot.searchKey || "ysb";
    const rows = products.length
      ? products
          .map(
            (item) => `
              <tr>
                <td class="price">${escapeHtml(formatMoney(item.price))}</td>
                <td class="stock">${escapeHtml(item.stockText || "")}</td>
                <td class="name">
                  <div>${escapeHtml(item.name || "")}</div>
                  <div class="muted">${escapeHtml(item.spec || "")}</div>
                  <div class="muted">${escapeHtml(item.manufacturer || "")}</div>
                </td>
                <td class="seller">${escapeHtml(item.seller || item.sellerRaw || "")}</td>
                <td class="date">${escapeHtml(item.validUntil || "")}</td>
                <td>${renderTags(item.tags || [])}</td>
              </tr>`
          )
          .join("")
      : '<tr><td colspan="6" class="ysb-helper-empty">暂无数据</td></tr>';

    uiState.root.innerHTML = `
      <div class="ysb-helper-wrap ${uiState.minimized ? "minimized" : ""}">
        <div class="ysb-helper-min-tab" data-action="expand">药师帮</div>
        <section class="ysb-helper-panel" aria-label="药师帮数据整理助手">
          <header class="ysb-helper-header">
            <div>
              <h2 class="ysb-helper-title">药师帮数据整理助手</h2>
              <div class="ysb-helper-subtitle">${escapeHtml(snapshot.searchKey ? `搜索：${snapshot.searchKey}` : "当前接口数据")}</div>
            </div>
            <button type="button" class="ysb-helper-icon-btn" data-action="minimize" title="收起">›</button>
          </header>
          <section class="ysb-helper-stats">
            <div class="ysb-helper-stat"><span>当前页</span><strong>${escapeHtml(snapshot.currentPageCount || products.length || 0)}</strong></div>
            <div class="ysb-helper-stat"><span>搜索总数</span><strong>${escapeHtml(snapshot.totalProducts || products.length || 0)}</strong></div>
            <div class="ysb-helper-stat"><span>最低单价</span><strong>${escapeHtml(formatMoney(snapshot.lowestPrice))}</strong></div>
            <div class="ysb-helper-stat"><span>商家数</span><strong>${escapeHtml(snapshot.sellerCount || 0)}</strong></div>
          </section>
          <section class="ysb-helper-tools">
            <input class="ysb-helper-search" data-field="keyword" type="search" placeholder="筛选品名、商家、厂家、标签" value="${escapeHtml(uiState.filters.keyword)}" />
            <label class="ysb-helper-check"><input data-field="freeShippingOnly" type="checkbox" ${uiState.filters.freeShippingOnly ? "checked" : ""} />包邮</label>
            <label class="ysb-helper-check"><input data-field="traceableOnly" type="checkbox" ${uiState.filters.traceableOnly ? "checked" : ""} />追溯码</label>
            <label class="ysb-helper-check"><input data-field="purchasedOnly" type="checkbox" ${uiState.filters.purchasedOnly ? "checked" : ""} />买过</label>
          </section>
          <section class="ysb-helper-actions">
            ${button("复制 CSV", "copy-csv", "primary")}
            ${button("下载 CSV", "download-csv")}
            ${button("复制 JSON", "copy-json")}
            ${button("下载 JSON", "download-json")}
          </section>
          <div class="ysb-helper-table-wrap">
            <table>
              <thead>
                <tr><th class="price">单价</th><th class="stock">库存</th><th>品名</th><th>商家</th><th class="date">有效期</th><th>标签</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <footer class="ysb-helper-footer">更新 ${escapeHtml(formatTime(snapshot.capturedAt))}</footer>
        </section>
      </div>`;
    uiState.root.querySelector('[data-action="download-csv"]')?.setAttribute("data-query", query);
  }

  function handlePanelInput(event) {
    const field = event.target && event.target.getAttribute("data-field");
    if (!field) return;
    if (field === "keyword") uiState.filters.keyword = event.target.value || "";
    if (field === "freeShippingOnly") uiState.filters.freeShippingOnly = Boolean(event.target.checked);
    if (field === "traceableOnly") uiState.filters.traceableOnly = Boolean(event.target.checked);
    if (field === "purchasedOnly") uiState.filters.purchasedOnly = Boolean(event.target.checked);
    updatePanel();
  }

  function handlePanelClick(event) {
    const actionNode = event.target && event.target.closest("[data-action]");
    if (!actionNode) return;
    const action = actionNode.getAttribute("data-action");
    const products = uiState.filtered || [];
    const snapshot = uiState.snapshot || {};
    const query = sanitizeFileName(snapshot.searchKey || "ysb");

    if (action === "minimize") {
      uiState.minimized = true;
      updatePanel();
      return;
    }
    if (action === "expand") {
      uiState.minimized = false;
      updatePanel();
      return;
    }
    if (action === "copy-csv") {
      copyText(toCsv(products));
      return;
    }
    if (action === "download-csv") {
      downloadText(toCsv(products), `${query}-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
      return;
    }
    if (action === "copy-json") {
      copyText(toJson(snapshot, products));
      return;
    }
    if (action === "download-json") {
      downloadText(toJson(snapshot, products), `${query}-${new Date().toISOString().slice(0, 10)}.json`, "application/json;charset=utf-8");
    }
  }

  function parseSpec(name) {
    const specMatch = cleanText(name).match(
      /[0-9.]+\s*(?:g|mg|ml|l|克|毫克|毫升|片|粒|袋|瓶|支|板|丸)\s*[*xX×]\s*[0-9.]+\s*(?:片|粒|袋|瓶|支|板|丸|盒|包)?|[0-9.]+\s*(?:g|mg|ml|l|克|毫克|毫升|片|粒|袋|瓶|支|板|丸)/i
    );
    return specMatch ? specMatch[0].replace(/\s+/g, "") : "";
  }

  function apiTags(item) {
    const tagValues = [
      getField(item, ["tags", "tagList", "labelList", "labels", "activityTags", "activities", "promotionList", "flagList"]),
      textField(item, ["tagName", "labelName", "activityName", "promotionName"])
    ];
    const tags = [];

    tagValues.forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === "object") {
            tags.push(entry.name || entry.label || entry.title || entry.tagName || entry.tagText || entry.value || "");
          } else {
            tags.push(entry);
          }
        });
      } else {
        cleanText(value)
          .split(/\s+|,|，|\/|;/)
          .forEach((part) => tags.push(part));
      }
    });

    const rawText = cleanText(JSON.stringify(item));
    [
      ["包邮", /包邮|免邮|freeShipping/i],
      ["溯", /追溯|trace|traceable|溯/i],
      ["扫", /扫码|scan/i],
      ["补贴", /补贴|subsidy/i],
      ["券", /优惠券|coupon|券/i],
      ["买过的店", /买过的店|recentlyPurchased|purchasedBefore/i],
      ["限购", /限购|purchaseLimit|limit/i]
    ].forEach(([label, pattern]) => {
      if (pattern.test(rawText)) tags.push(label);
    });

    return uniqueList(tags);
  }

  function normalizeApiProduct(item, index, snapshotUrl) {
    const name = textField(item, [
      "name",
      "drugName",
      "goodsName",
      "productName",
      "showName",
      "commonName",
      "title",
      "skuName",
      "commodityName",
      "wholesaleName"
    ]);
    const spec =
      textField(item, ["spec", "specs", "specification", "specificationName", "packageSpec", "drugSpec", "standard"]) ||
      parseSpec(name);
    const seller = textField(item, [
      "providerName",
      "providerShortName",
      "shopName",
      "storeName",
      "sellerName",
      "supplierName",
      "merchantName",
      "providerAlias"
    ]);
    const manufacturer = textField(item, [
      "manufacturer",
      "manufacturerName",
      "factoryName",
      "factory",
      "productionEnterprise",
      "enterpriseName",
      "producerName"
    ]);
    let price = numberField(item, [
      "price",
      "salePrice",
      "wholesalePrice",
      "activityPrice",
      "actualPrice",
      "finalPrice",
      "retailPrice",
      "unitPrice",
      "minPrice",
      "amount"
    ]);
    const centPrice = numberField(item, ["priceCent", "salePriceCent", "amountCent"]);
    if (!Number.isFinite(price) && Number.isFinite(centPrice)) price = centPrice / 100;

    const stockRaw = getPathValue(item, ["joinCarMap", "stockAvailable"]);
    const stockText = valueText(stockRaw);
    const stock = typeof stockRaw === "number" ? stockRaw : parseNumber(stockRaw);

    const validUntil = textField(item, [
      "validUntil",
      "validDate",
      "validMonth",
      "validityDate",
      "expiryDate",
      "expireDate",
      "nearEffectDate"
    ]).replace(/^有效期\s*/, "");
    const tags = apiTags(item);
    const rawText = cleanText(JSON.stringify(item));

    return {
      index: index + 1,
      name,
      spec,
      manufacturer,
      seller,
      sellerRaw: seller,
      price: Number.isFinite(price) ? price : null,
      stockText,
      stock: Number.isFinite(stock) ? stock : null,
      validUntil,
      tags,
      freeShipping: /包邮|免邮|freeShipping/i.test(rawText),
      traceable: /追溯|trace|traceable|溯/i.test(rawText),
      scanRequired: /扫码|scan/i.test(rawText),
      purchasedBefore: /买过的店|recentlyPurchased|purchasedBefore/i.test(rawText),
      purchaseLimit: numberField(item, ["purchaseLimit", "limitNum", "limitBuyNum", "quotaNum"]),
      url: snapshotUrl || window.location.href,
      key: [name, seller, Number.isFinite(price) ? price : "", validUntil].join("|")
    };
  }

  function scoreApiArrayCandidate(entry) {
    const path = String(entry && entry.path ? entry.path : "");
    let score = Number(entry && entry.score ? entry.score : 0) + Number(entry && entry.matchedLength ? entry.matchedLength : 0);

    if (/drugList|goodsList|productList|wholesaleList|records|items/i.test(path)) score += 1000;
    if (/filter|facet|option|select|providerFilter|factoryFilter|specFilter|gradeName|exeStandard/i.test(path)) score -= 1000;
    if (/provider|factory|spec|grade|standard/i.test(path) && !/drug|goods|product|wholesale/i.test(path)) score -= 500;

    const sampleText = cleanText(JSON.stringify((entry.sample && entry.sample[0]) || {}));
    if (/price|salePrice|wholesalePrice|valid|purchaseLimit|minBuy|起购|限购|有效期|价格/i.test(sampleText)) score += 200;
    if (!/price|salePrice|wholesalePrice|amount|valid|purchase|limit|stock|qty|quantity|有效期|价格|库存/i.test(sampleText)) score -= 400;

    return score;
  }

  function buildSnapshot(reason) {
    const url = apiState.apiSourceUrl || window.location.href;
    const params = parseSearchParams(url);
    const products = apiState.apiProducts.slice();
    const prices = products.map((item) => item.price).filter((price) => Number.isFinite(price));
    const sellerCount = new Set(products.map((item) => item.seller || item.sellerRaw).filter(Boolean)).size;
    const apiMeta = apiState.apiMeta || {};

    return {
      source: products.length ? "api-parse" : "api-waiting",
      reason: reason || "manual",
      url,
      title: document.title,
      searchKey: cleanText(params.get("searchkey") || ""),
      capturedAt: new Date().toISOString(),
      totalProducts: Number(apiMeta.totalProducts || 0) || products.length,
      page: Number(apiMeta.page || 0) || Number(params.get("page") || 0) || null,
      totalPages: Number(apiMeta.totalPages || 0) || null,
      currentPageCount: products.length,
      sellerCount,
      lowestPrice: prices.length ? Math.min.apply(null, prices) : null,
      products
    };
  }

  function snapshotSignature(snapshot) {
    const first = snapshot.products[0] && snapshot.products[0].key;
    const last = snapshot.products[snapshot.products.length - 1] && snapshot.products[snapshot.products.length - 1].key;
    return [snapshot.source, snapshot.searchKey, snapshot.currentPageCount, snapshot.totalProducts, first, last].join("::");
  }

  function saveSnapshot(snapshot, force) {
    const signature = snapshotSignature(snapshot);
    if (!force && signature === apiState.lastSignature) return snapshot;
    apiState.lastSignature = signature;
    apiState.lastSnapshot = snapshot;
    uiState.snapshot = snapshot;
    updatePanel();
    return snapshot;
  }

  function saveCurrentSnapshot(reason, force) {
    return saveSnapshot(buildSnapshot(reason), force);
  }

  function clearInterfaceProducts() {
    apiState.lastSignature = "";
    apiState.lastSnapshot = null;
    apiState.apiProducts = [];
    apiState.apiMeta = null;
    apiState.apiSourceUrl = "";
    uiState.snapshot = null;
    uiState.filtered = [];
    removePanel();
  }

  function setupUrlWatcher() {
    let lastHref = window.location.href;
    window.setInterval(() => {
      if (lastHref === window.location.href) return;
      lastHref = window.location.href;
      clearInterfaceProducts();
      updatePanel();
    }, 800);
  }

  function setupApiListener() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || !event.data || event.data.source !== SOURCE) return;
      if (event.data.type !== "parsed-products") return;

      const arrays = Array.isArray(event.data.arrays) ? event.data.arrays : [];
      const best = arrays
        .filter((entry) => Array.isArray(entry.items) && entry.items.length)
        .sort((a, b) => scoreApiArrayCandidate(b) - scoreApiArrayCandidate(a))[0];

      if (best) {
        apiState.apiSourceUrl = window.location.href;
        apiState.apiProducts = best.items.map((item, index) => normalizeApiProduct(item, index, apiState.apiSourceUrl));
        apiState.apiMeta = event.data.meta || null;
        saveCurrentSnapshot("api-parse");
      }
    });
  }

  setupApiListener();
  setupUrlWatcher();
})();
