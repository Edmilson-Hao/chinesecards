// js/router.js
import { ui } from './ui.js';
import { management } from './management.js';
import { statistics } from './statistics.js';
import { importExport } from './importExport.js';

export const router = {
  init: () => {
    console.log("Roteador modular preparado.");
  },
  executeViewModule: (view, container) => {
    if (!container) return;
    switch (view) {
      case 'manage':
        management.render();
        break;
      case 'stats':
        statistics.render();
        break;
      case 'io':
        importExport.render();
        break;
    }
  }
};