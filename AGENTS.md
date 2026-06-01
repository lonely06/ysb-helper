# AGENTS.md

## Project Overview

This project is a Chrome Manifest V3 extension for `https://dian.ysbang.cn/#/indexContent`.

The extension helps organize YSB search result data by capturing the page-decrypted result of:

`/wholesale-drug/sales/getWholesaleList/v4270`

It does not decrypt the API response itself and does not scrape product cards from the DOM. It listens for the target API request, captures structured product arrays after the page calls `JSON.parse`, normalizes the product data, and renders a right-side floating panel directly on the target page.

## Current Structure

- `manifest.json`: MV3 manifest. It injects two content scripts and intentionally has no toolbar popup.
- `src/pageHook.js`: Runs in `world: "MAIN"` at `document_start`. Wraps `fetch`, `XMLHttpRequest.open`, and `JSON.parse` to detect parsed product data after the site decrypts the response.
- `src/content.js`: Runs in `world: "ISOLATED"`. Receives parsed product arrays, normalizes fields, and renders the right-side floating panel.
- `README.md`: User-facing install and usage notes.

## Important Constraints

- Keep the implementation API-parse only. Do not reintroduce DOM scraping from product cards.
- Do not add a browser action popup unless explicitly requested. The current UI is a page-level right-side floating panel.
- Show the floating panel only when:
  - `window.location.origin === "https://dian.ysbang.cn"`
  - `window.location.hash` starts with `#/indexContent`
  - parsed API product data exists
- The panel must support minimizing to the right side and expanding again.
- Preserve product order from the API parse result. Do not sort product rows by price or other fields unless explicitly requested.
- Inventory is fixed to `joinCarMap.stockAvailable`.
- Product ID fields were investigated and intentionally removed because the desired ID is not present in the response data.
- Avoid adding extension permissions unless they are required. The current extension does not need `activeTab`, `storage`, or popup permissions.

## Field Notes

Normalized product fields currently include:

- `index`
- `name`
- `spec`
- `manufacturer`
- `seller`
- `sellerRaw`
- `price`
- `stockText`
- `stock`
- `validUntil`
- `tags`
- `freeShipping`
- `traceable`
- `scanRequired`
- `purchasedBefore`
- `purchaseLimit`
- `url`
- `key`

CSV/JSON exports should stay aligned with the fields shown in the floating panel unless the user asks for extra diagnostic data.

## Verification

Run these checks after code changes:

```sh
node --check src/pageHook.js
node --check src/content.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

Useful residue checks:

```sh
rg -n "popup|default_popup|activeTab|storage|chrome\\.tabs|chrome\\.storage|商品ID|ID候选|DOM|MutationObserver|innerText|all-goods-wrapper" src README.md manifest.json
```

Expected source files:

```text
manifest.json
src/content.js
src/pageHook.js
```

## Development Style

- Keep changes tightly scoped.
- Prefer plain JavaScript and MV3-compatible APIs.
- The injected panel uses Shadow DOM and inline styles inside `content.js` to avoid conflicts with the host page.
- Keep text in Chinese for user-visible UI.
- Use ASCII in files unless existing content or user-facing Chinese text requires otherwise.

## Commit Messages

Use this format:

```text
概述
- 详情
- 详情
```
