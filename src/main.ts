import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import { registerAllModules } from './modules/index';
import { initTheme } from './shell/theme';
import { registerServiceWorker } from './shell/pwa';
import { startShell } from './shell/app';

initTheme();
registerAllModules();
registerServiceWorker();
startShell(document.getElementById('app')!);
