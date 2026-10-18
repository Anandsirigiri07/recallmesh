import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9223;
const USER_DATA_DIR = path.resolve('scratch_edge_profile_actions');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureViewports() {
  const targets = [
    { name: 'action_plans_desktop_1440x900.png', width: 1440, height: 900 },
    { name: 'action_plans_tablet_820x1180.png', width: 820, height: 1180 },
    { name: 'action_plans_phone_390x844.png', width: 390, height: 844 },
  ];

  console.log('Launching headless Edge on port', PORT);
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${USER_DATA_DIR}`,
    'about:blank',
  ]);

  edgeProc.stderr.on('data', () => {});

  // Wait for edge to start listening
  await delay(2000);

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json`);
    const pages = await listRes.json();
    const targetPage = pages.find((p) => p.type === 'page') || pages[0];
    if (!targetPage || !targetPage.webSocketDebuggerUrl) {
      throw new Error('No page WebSocket URL found');
    }

    const wsUrl = targetPage.webSocketDebuggerUrl;
    console.log('Connecting to DevTools at', wsUrl);

    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
    };

    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    for (const t of targets) {
      console.log(`Setting viewport: ${t.width}x${t.height} for ${t.name}`);
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: t.width,
        height: t.height,
        deviceScaleFactor: 1,
        mobile: t.width <= 480,
      });

      console.log('Navigating to http://127.0.0.1:5173/#action-plans ...');
      await sendCommand('Page.navigate', {
        url: 'http://127.0.0.1:5173/#action-plans',
      });

      // Wait for fonts to load and React render
      await sendCommand('Runtime.evaluate', { expression: 'document.fonts.ready' });
      await delay(4000);

      const screenshotRes = await sendCommand('Page.captureScreenshot', {
        format: 'png',
      });

      const buffer = Buffer.from(screenshotRes.data, 'base64');
      fs.writeFileSync(t.name, buffer);
      console.log(`Saved screenshot to ${t.name} (${buffer.length} bytes)`);
    }

    ws.close();
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch (_) {}
  }
}

captureViewports()
  .then(() => {
    console.log('All Action Plans screenshots captured successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error during screenshot capture:', err);
    process.exit(1);
  });
