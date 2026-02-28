# Autoya

Selfbot Discord pour automatiser la commande `$p` de Mudae.

## Avertissement

L'utilisation de selfbots viole les conditions d'utilisation de Discord. Utilisation à vos propres risques.

## Installation

```bash
npm install
```

## Configuration & Utilisation

### Récupération du token
```js
if(window.Sentry){window.Sentry.init=()=>{};window.Sentry.captureException=()=>{};window.Sentry.captureMessage=()=>{};window.Sentry.withScope=cb=>cb({setTag:()=>{},setContext:()=>{}});}console.error=()=>{};console.warn=()=>{};console.info=()=>{};window.addEventListener("error",e=>e.preventDefault());window.addEventListener("unhandledrejection",e=>e.preventDefault());webpackChunkdiscord_app.push([[Math.random()],{},e=>{for(let c in e.c){try{let m=e.c[c].exports;if(m&&m.default&&typeof m.default.getToken==="function"){let t=m.default.getToken();if(typeof t==="string")console.log("Token:",t)}}catch{}}}])
```
**Cette commande permet de récupérer automatiquement votre token, si vous ne pouvez pas la coller, tapez `allow pasting`**


Lancez `launch.bat` et répondez aux questions.
