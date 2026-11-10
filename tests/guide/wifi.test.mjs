import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import QRCode from 'qrcode';
import { wifiQrPayload } from '../../src/guide/lib/wifi.ts';
import apartment from '../../src/guide/data/apartment.json' with { type: 'json' };

test('Wi-Fi QR uses the standard WPA payload and escapes reserved characters', () => {
  assert.equal(wifiQrPayload('NatureNook-Demo', 'Fern!72Pebble'), 'WIFI:T:WPA;S:NatureNook-Demo;P:Fern!72Pebble;;');
  assert.equal(wifiQrPayload('Cafe;,:"\\', 'a;,:"\\b'), String.raw`WIFI:T:WPA;S:Cafe\;\,\:\"\\;P:a\;\,\:\"\\b;;`);
  assert.equal(wifiQrPayload('Nook ž', 'Pässword!'), 'WIFI:T:WPA;S:Nook ž;P:Pässword!;;');
});

test('share Wi-Fi QR SVG encodes the displayed network/password, not the guide URL', async () => {
  const { network, password } = apartment.wifi;
  const expected = await QRCode.toString(`WIFI:T:WPA;S:${network};P:${password};;`, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 4,
    color: { dark: '#183c2dff', light: '#ffffffff' }, width: 320,
  });
  const { document: expectedDocument } = parseHTML(expected);
  const { document } = parseHTML(await readFile(new URL('../../dist/stay-k7m4/share/index.html', import.meta.url), 'utf8'));
  assert.equal(document.querySelector('#wifi-qr svg').outerHTML, expectedDocument.querySelector('svg').outerHTML);
  assert.notEqual(document.querySelector('#wifi-qr svg').outerHTML, document.querySelector('#guide-qr svg').outerHTML);
  assert.equal(document.querySelector('#wifi-network').textContent, network);
  assert.equal(document.querySelector('#wifi-password').textContent, password);
});
