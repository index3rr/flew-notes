import config from './playwright.config';
import fs from 'node:fs';
import path from 'node:path';
const root = process.env.PLAYWRIGHT_BROWSERS_PATH!;
const binary = (prefix: string, suffix: string) => path.join(root, fs.readdirSync(root).find((name) => name.startsWith(prefix))!, suffix);
export default {
 ...config,
 workers: 3,
 projects: [
  {name:'Chrome', use:{browserName:'chromium', launchOptions:{executablePath:binary('chromium-', 'chrome-linux64/chrome')}}},
  {name:'Firefox', use:{browserName:'firefox', launchOptions:{executablePath:binary('firefox-', 'firefox/firefox')}}},
  {name:'WebKit', use:{browserName:'webkit', launchOptions:{executablePath:binary('webkit-', 'pw_run.sh')}}}
 ]
};
