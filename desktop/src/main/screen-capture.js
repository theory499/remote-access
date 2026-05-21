'use strict';

const { desktopCapturer } = require('electron');

async function listScreenSources(types = ['screen']) {
  const sources = await desktopCapturer.getSources({ types });
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    display_id: source.display_id
  }));
}

async function selectPrimaryScreen() {
  const sources = await listScreenSources(['screen']);
  if (sources.length === 0) {
    throw new Error('No screen sources available for capture');
  }
  return sources[0];
}

module.exports = { listScreenSources, selectPrimaryScreen };
