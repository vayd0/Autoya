const { Client } = require('discord.js-selfbot-v13');
const { execSync: _exec } = require('child_process');

if (process.platform === 'win32') {
  try { _exec('reg add HKCU\\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f', { stdio: 'ignore' }); } catch {}
}
const fs   = require('fs');
const path = require('path');

const c = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  red:      '\x1b[31m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  white:    '\x1b[97m',
  gray:     '\x1b[90m',
  bRed:     '\x1b[91m',
  bGreen:   '\x1b[92m',
  bYellow:  '\x1b[93m',
  bMagenta: '\x1b[95m',
};

const paint = (color, text) => `${color}${text}${c.reset}`;
const sleep  = ms => new Promise(r => setTimeout(r, ms));

const cursor = {
  hide:      () => process.stdout.write('\x1b[?25l'),
  show:      () => process.stdout.write('\x1b[?25h'),
  clearLine: () => process.stdout.write('\x1b[2K'),
  col:       (n = 0) => process.stdout.write(`\x1b[${n}G`),
};

async function typewrite(text, delay = 14) {
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
    process.stdout.write(
      `\r  ${paint(c.bRed, frames[i])}  ${paint(c.white, text)}`
    );
    i = (i + 1) % frames.length;
  }, 80);
  return {
    stop: (msg, ok = true) => {
      clearInterval(interval);
      cursor.show();
      const icon = ok ? paint(c.bGreen, '✔') : paint(c.bRed, '✖');
      process.stdout.write(
        `\r\x1b[2K  ${icon}  ${paint(ok ? c.bGreen : c.bRed, msg)}\n`
      );
    }
  };
}

async function log(icon, msg, iconColor, msgColor, delay = 10) {
  await typewrite(`  ${paint(iconColor, icon)}  ${paint(msgColor, msg)}`, delay);
}

function ts() {
  const now = new Date();
  const hh  = String(now.getUTCHours()).padStart(2, '0');
  const mm  = String(now.getUTCMinutes()).padStart(2, '0');
  const ss  = String(now.getUTCSeconds()).padStart(2, '0');
  return paint(c.gray, `[${hh}:${mm}:${ss}]`);
}

async function logTs(icon, msg, iconColor, msgColor, delay = 10) {
  await typewrite(`  ${ts()}  ${paint(iconColor, icon)}  ${paint(msgColor, msg)}`, delay);
}

const configPath = path.join(__dirname, '../data/config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
  process.stdout.write(`  ${paint(c.bRed, '✖')}  ${paint(c.red, 'Impossible de lire config.json')}\n`);
  process.exit(1);
}

function msUntilNextRound() {
  const now = new Date();
  const elapsed = (now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000 + now.getUTCMilliseconds();
  return 3600000 - elapsed;
}

function nextRoundLabel() {
  const next = new Date(Date.now() + msUntilNextRound());
  const hh   = String(next.getUTCHours()).padStart(2, '0');
  return `${hh}:00 UTC`;
}

const client = new Client();

async function sendP() {
  const spin = spinner(`Envoi de ${paint(c.bMagenta, '$p')}${paint(c.white, '...')}`);
  try {
    const channel = await client.channels.fetch(config.channelId);
    if (channel && channel.isText()) {
      await channel.send('$p');
      spin.stop(`Commande ${paint(c.bMagenta, '$p')}${paint(c.bGreen, ' envoyée avec succès.')}`);
    } else {
      spin.stop('Channel introuvable ou non textuel.', false);
    }
  } catch (err) {
    spin.stop(`${paint(c.red, err.message)}`, false);
  }
}

function scheduleNextRound() {
  const ms   = msUntilNextRound();
  const label = nextRoundLabel();
  const mins  = Math.round(ms / 60000);

  log('·', `Prochaine ronde à ${paint(c.bYellow, label)} ${paint(c.gray, `(dans ${mins} min)`)}`, c.gray, c.gray, 8);

  setTimeout(async () => {
    console.log();
    await logTs('›', `Ronde ${paint(c.bYellow, label)}`, c.bYellow, c.yellow, 10);
    await sendP();
    scheduleNextRound();
  }, ms);
}

client.on('ready', async () => {
  console.log();
  await log('✔', `Connecté en tant que ${paint(c.bMagenta, client.user.tag)}`, c.bGreen, c.green, 12);
  await log('·', `Channel cible : ${paint(c.bYellow, config.channelId)}`, c.gray, c.gray, 10);
  console.log();

  await sendP();
  scheduleNextRound();
});

client.on('messageCreate', async (message) => {
  if (message.author.id !== client.user.id) return;
  if (message.content === '$p') {
    await logTs(
      '·',
      `${paint(c.bMagenta, '$p')} ${paint(c.gray, 'confirmé dans')} ${paint(c.bYellow, '#' + (message.channel.name || message.channel.id))}`,
      c.gray, c.white, 8
    );
  }
});

(async () => {
  console.log();
  const spin = spinner('Connexion à Discord...');
  try {
    await client.login(config.token);
    spin.stop('Connexion établie.');
  } catch {
    spin.stop('Token invalide ou expiré.', false);
    process.exit(1);
  }
})();

process.on('SIGINT', async () => {
  console.log();
  await log('·', 'Arrêt du bot...', c.gray, c.gray, 8);
  cursor.show();
  process.exit(0);
});