// Multi-shot: navigate sanchoi.app and capture each game screen
// Usage: node shot-all.js <debug-port> <output-dir>
const port = process.argv[2] || "9222";
const outdir = process.argv[3] || "/tmp/sanchoi-shots";
const fs = require("fs");
fs.mkdirSync(outdir, { recursive: true });

const VIEWPORT_W = 1440;
const VIEWPORT_H = 960; // 3:2 ratio
const SCALE = 2;

async function cdp(ws, method, params = {}) {
  return new Promise((res, rej) => {
    const id = Date.now() + Math.random();
    const handler = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener("message", handler);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function shot(ws, name) {
  await cdp(ws, "Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT_W, height: VIEWPORT_H, deviceScaleFactor: SCALE, mobile: false
  });
  await new Promise(r => setTimeout(r, 1000));
  const shot = await cdp(ws, "Page.captureScreenshot", {
    format: "png", captureBeyondViewport: true, fromSurface: true
  });
  const path = `${outdir}/${name}.png`;
  fs.writeFileSync(path, Buffer.from(shot.data, "base64"));
  const stat = fs.statSync(path);
  console.log(`  ${name}.png  ${(stat.size / 1024).toFixed(0)}KB  ${VIEWPORT_W * SCALE}x${VIEWPORT_H * SCALE}`);
}

async function click(ws, selector) {
  // Find element and click it via JS
  const result = await cdp(ws, "Runtime.evaluate", {
    expression: `(() => {
      const el = document.querySelector('${selector}');
      if (!el) return 'NOT_FOUND: ${selector}';
      el.click();
      return 'OK';
    })()`,
    returnByValue: true
  });
  return result.result.value;
}

async function evalJS(ws, expr) {
  const result = await cdp(ws, "Runtime.evaluate", {
    expression: expr,
    returnByValue: true
  });
  return result.result.value;
}

async function waitForSelector(ws, selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await evalJS(ws, `!!document.querySelector('${selector}')`);
    if (found) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = list.find(t => t.type === "page");
  if (!page) throw new Error("no page target");

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");

  // Navigate to sanchoi.app
  await cdp(ws, "Page.navigate", { url: "https://sanchoi.app" });
  await new Promise(r => setTimeout(r, 4000));

  // 1. Hub landing page (with gate/lantern)
  console.log("1. Hub landing");
  await shot(ws, "01-hub-landing");

  // Click "Chơi ngay" to enter the hub
  console.log("  clicking Chơi ngay...");
  const gateBtn = await click(ws, "#gate-btn");
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, "02-hub-games");

  // 2. Ô ăn quan - click on the game card
  console.log("2. Ô ăn quan");
  const oaq = await click(ws, '[data-game-id="o-an-quan"]');
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, "03-o-an-quan");

  // Go back to hub
  const back1 = await click(ws, "#back-btn");
  await new Promise(r => setTimeout(r, 1500));

  // 3. Bầu cua
  console.log("3. Bầu cua");
  const bc = await click(ws, '[data-game-id="bau-cua"]');
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, "04-bau-cua");

  // Go back
  const back2 = await click(ws, "#back-btn");
  await new Promise(r => setTimeout(r, 1500));

  // 4. Water puppet
  console.log("4. Water puppet");
  const wp = await click(ws, '[data-game-id="water-puppet"]');
  await new Promise(r => setTimeout(r, 3000));
  await shot(ws, "05-water-puppet");

  // Go back
  const back3 = await click(ws, "#back-btn");
  await new Promise(r => setTimeout(r, 1500));

  // 5. Gióng's Iron Garage
  console.log("5. Gióng's Iron Garage");
  const gg = await click(ws, '[data-game-id="gia-ngua"]');
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, "06-gia-ngua");

  // Go back
  const back4 = await click(ws, "#back-btn");
  await new Promise(r => setTimeout(r, 1500));

  // 6. Rồng rắn lên mây
  console.log("6. Rồng rắn");
  const rr = await click(ws, '[data-game-id="rong-ran"]');
  await new Promise(r => setTimeout(r, 2000));
  await shot(ws, "07-rong-ran");

  ws.close();
  console.log("\nDONE — all shots in", outdir);
  process.exit(0);
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
