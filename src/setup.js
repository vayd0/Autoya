#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

if (process.platform === 'win32') {
  try { execSync('reg add HKCU\\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f', { stdio: 'ignore' }); } catch {}
}

const c = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  red:      '\x1b[31m',
  white:    '\x1b[97m',
  gray:     '\x1b[90m',
  bGreen:   '\x1b[92m',
  bYellow:  '\x1b[93m',
  bRed:     '\x1b[91m',
  bMagenta: '\x1b[95m',
};

const paint = (color, text) => `${color}${text}${c.reset}`;
const sleep  = ms => new Promise(r => setTimeout(r, ms));

const cursor = {
  hide:      () => process.stdout.write('\x1b[?25l'),
  show:      () => process.stdout.write('\x1b[?25h'),
  up:        (n = 1) => process.stdout.write(`\x1b[${n}A`),
  col:       (n = 0) => process.stdout.write(`\x1b[${n}G`),
  clearLine: () => process.stdout.write('\x1b[2K'),
};

async function typewrite(text, delay = 18) {
  const ANSI_RE = /\x1b\[[\d;]*m/g;
  let last = 0;
  const tokens = [];
  let m;
  while ((m = ANSI_RE.exec(text)) !== null) {
    if (m.index > last) {
      for (const ch of text.slice(last, m.index)) tokens.push({ type: 'char', v: ch });
    }
    tokens.push({ type: 'ansi', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    for (const ch of text.slice(last)) tokens.push({ type: 'char', v: ch });
  }
  for (const tok of tokens) {
    process.stdout.write(tok.v);
    if (tok.type === 'char') await sleep(delay);
  }
  process.stdout.write('\n');
}

function spinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  cursor.hide();
  const interval = setInterval(() => {
    process.stdout.write(`\r  ${paint(c.bRed, frames[i])}  ${paint(c.white, text)}`);
    i = (i + 1) % frames.length;
  }, 80);
  return {
    stop: (msg, ok = true) => {
      clearInterval(interval);
      cursor.show();
      const icon = ok ? paint(c.bGreen, '✔') : paint(c.bRed, '✖');
      process.stdout.write(`\r\x1b[2K  ${icon}  ${paint(ok ? c.bGreen : c.bRed, msg)}\n`);
    }
  };
}

async function statusLine(msg, color = c.gray, icon = '·', delay = 8) {
  await typewrite(`  ${paint(color, icon)}  ${paint(color, msg)}`, delay);
}

async function sectionHeader(title) {
  cursor.hide();
  await typewrite(paint(c.bRed,  `  ┏${'·'.repeat(36)}┓`), 4);
  await typewrite(paint(c.white, `  ┃  ${title.padEnd(34)}┃`), 6);
  await typewrite(paint(c.bRed,  `  ┗${'·'.repeat(36)}┛`), 4);
  console.log();
  cursor.show();
}

function createRL() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question, defaultVal = '') {
  return new Promise(resolve => {
    const hint = defaultVal ? paint(c.gray, ` [${defaultVal}]`) : '';
    rl.question(
      `  ${paint(c.bRed, '?')}  ${paint(c.white, question)}${hint}${paint(c.gray, ' › ')}`,
      answer => resolve(answer.trim() || defaultVal)
    );
  });
}

function askSecret(question) {
  return new Promise(resolve => {
    process.stdout.write(
      `  ${paint(c.bRed, '?')}  ${paint(c.white, question)}${paint(c.gray, ' › ')}`
    );
    let value = '';
    const onData = (char) => {
      char = char.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        cursor.show(); process.exit();
      } else if (char === '\u007f') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          cursor.clearLine(); cursor.col(0);
          process.stdout.write(
            `  ${paint(c.bRed, '?')}  ${paint(c.white, question)}${paint(c.gray, ' › ')}${paint(c.gray, '•'.repeat(value.length))}`
          );
        }
      } else {
        value += char;
        process.stdout.write(paint(c.gray, '•'));
      }
    };
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function askYesNo(rl, question, defaultVal = false) {
  const hint = defaultVal ? 'O/n' : 'o/N';
  const answer = await ask(rl, `${question} ${paint(c.gray, `(${hint})`)}`, '');
  if (answer === '') return defaultVal;
  return answer.toLowerCase() === 'o' || answer.toLowerCase() === 'y';
}

function checkNodeModules() {
  return fs.existsSync(path.join(process.cwd(), 'node_modules'));
}

function installDeps() {
  const spin = spinner('Installation des dépendances...');
  try {
    execSync('npm install', { stdio: 'ignore' });
    spin.stop('Dépendances installées avec succès.');
  } catch {
    spin.stop("Erreur lors de l'installation.", false);
    process.exit(1);
  }
}

function needsSetup() {
  const configPath = path.join(process.cwd(), 'data', 'config.json');
  if (!fs.existsSync(configPath)) return true;
  try {
    return !JSON.parse(fs.readFileSync(configPath, 'utf8')).setup;
  } catch { return true; }
}

function saveConfig(token, channelId, startup) {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'config.json'),
    JSON.stringify({ token, channelId, startup, setup: true }, null, 2)
  );
}

function addToStartup() {
  try {
    const launchPath = path.join(process.cwd(), 'launch.bat').replace(/\\/g, '\\\\');
    execSync(
      `powershell -Command "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut([Environment]::GetFolderPath('Startup') + '\\\\Autoya.lnk'); $l.TargetPath = '${launchPath}'; $l.Save()"`,
      { stdio: 'ignore' }
    );
    return true;
  } catch { return false; }
}

async function main() {
  process.on('exit',   () => cursor.show());
  process.on('SIGINT', () => { cursor.show(); process.exit(); });


  if (!checkNodeModules()) {
    installDeps();
    console.log();
  }

  if (!needsSetup()) {
    await statusLine('Configuration existante détectée.', c.gray, '✔');
    startBot();
    return;
  }

  await sectionHeader('PREMIERE CONFIGURATION');

  await typewrite(`  ${paint(c.gray, 'Ton token Discord, il ne sera jamais affiché.')}`, 10);
  console.log();
  const token = await askSecret('Token Discord');

  if (!token) {
    console.log();
    await typewrite(`  ${paint(c.bRed, '✖')}  ${paint(c.red, 'Le token est requis.')}`, 12);
    process.exit(1);
  }

  const rl = createRL();

  console.log();
  const channelId = await ask(rl, 'ID du channel Discord');
  if (!channelId) {
    console.log();
    await typewrite(`  ${paint(c.bRed, '✖')}  ${paint(c.red, "L'ID du channel est requis.")}`, 12);
    rl.close(); process.exit(1);
  }
  console.log();
  const startup = await askYesNo(rl, 'Lancer Autoya au démarrage de Windows ?', false);
  rl.close();

  console.log();
  const saveSpin = spinner('Sauvegarde de la configuration...');
  await sleep(600);
  saveConfig(token, channelId, startup);
  saveSpin.stop('Configuration sauvegardée !');

  if (startup) {
    const startSpin = spinner('Création du raccourci de démarrage...');
    await sleep(500);
    const ok = addToStartup();
    startSpin.stop(
      ok ? 'Démarrage automatique activé.' : 'Impossible de créer le raccourci.',
      ok
    );
  }

  startBot();
}

function startBot() {
  console.log();
  const { spawn } = require('child_process');
  const bot = spawn('npm', ['start'], { stdio: 'inherit', shell: true });
  bot.on('close', async (code) => {
    console.log();
    if (code !== 0) {
      await typewrite(`  ${paint(c.bRed, '✖')}  ${paint(c.red, `Le bot s'est arrêté (code ${code}).`)}`, 12);
    } else {
      await typewrite(`  ${paint(c.gray, '·')}  ${paint(c.gray, 'Bot arrêté.')}`, 12);
    }
  });
}

main().catch(async err => {
  cursor.show();
  await typewrite(paint(c.bRed, `\n  Erreur fatale: ${err.message}`), 12);
  process.exit(1);
});