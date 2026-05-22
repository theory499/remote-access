'use strict';

const QRCode = require('qrcode');

const { buildMobilePayload } = require('../shared/backend-config');

async function generateMobileQr(fullConfig, { size = 512, errorCorrectionLevel = 'M' } = {}) {
  const payload = buildMobilePayload(fullConfig);
  if (!payload) throw new Error('Invalid configuration for QR payload');
  const encoded = JSON.stringify(payload);
  const dataUrl = await QRCode.toDataURL(encoded, {
    width: size,
    errorCorrectionLevel,
    margin: 1
  });
  return { dataUrl, payload, encoded };
}

module.exports = { generateMobileQr };
