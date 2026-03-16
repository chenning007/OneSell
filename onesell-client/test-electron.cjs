console.log('[TEST] process.type:', process.type); const e = require('electron'); console.log('[TEST] typeof e:', typeof e, '/ e.app:', typeof e.app); setTimeout(function(){process.exit(0);}, 500);
