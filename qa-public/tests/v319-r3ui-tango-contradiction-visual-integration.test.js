#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');

const candidates=[path.resolve(__dirname,'../GitHub'),path.resolve(__dirname,'../../GitHub'),path.resolve(__dirname,'../..'),path.resolve(__dirname,'..')];
const RUNTIME=candidates.find(base=>fs.existsSync(path.join(base,'index.html')));
assert(RUNTIME,'cannot locate QUADLUD runtime');

const index=fs.readFileSync(path.join(RUNTIME,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(RUNTIME,'sw.js'),'utf8');
const css=fs.readFileSync(path.join(RUNTIME,'tango-human-pedagogy-r4.css'),'utf8');
const visual=fs.readFileSync(path.join(RUNTIME,'tango-contradiction-visuals.js'),'utf8');
const nav=fs.readFileSync(path.join(RUNTIME,'tutor-action-first-navigation.js'),'utf8');

const visualUrl='tango-contradiction-visuals.js?v=3.1.9-r3ui-contradiction-visual-r1';
const cssUrl='tango-human-pedagogy-r4.css?v=3.1.9-r3ui-contradiction-visual-r1';
assert(index.includes(`<script src="${visualUrl}"></script>`),'index must load contradiction visuals');
assert(index.includes(`<link rel="stylesheet" href="${cssUrl}" />`),'index must load contradiction visual CSS cache-bust');
assert(sw.includes(`./${visualUrl}`),'service worker must precache contradiction visual module');
assert(sw.includes(`./${cssUrl}`),'service worker must precache matching contradiction visual CSS');
assert(sw.includes("const CACHE='quadlud-v3.1.9-r3ui-contradiction-visual-r1'"),'service-worker cache identity must be bumped for the visual change');
assert(index.indexOf('tutor-action-first-navigation.js')<index.indexOf('tango-contradiction-visuals.js'),'contradiction decorator must load after Tutor action projection');

assert(/\.walkthrough-hypothetical-symbol\s*\{[^}]*opacity:\s*\.5\s*;/s.test(css),'hypothetical sun/moon symbols must render at exactly 50% opacity');
assert(css.includes('.walkthrough-hypothetical-badge'),'number/H badge styling missing');
assert(css.includes('[data-contradiction-visual="contradiction"] .walkthrough-contradiction-cell'),'red contradiction halo selector missing');
assert(css.includes('var(--danger)'),'contradiction halo must use the application danger semantic color');
assert(css.includes('@media(max-width:520px)'),'mobile badge sizing missing');
assert(css.includes('@media(forced-colors:active)'),'forced-colors fallback missing');

assert(visual.includes("label:'H'"),'visual model must mark the initial hypothesis with H');
assert(visual.includes("kind:'consequence'"),'visual model must expose numbered hypothetical consequences');
assert(visual.includes("stageKind==='contradiction'"),'visual model must expose the contradiction stage');
assert(visual.includes("if(!state.active)return false"),'real action stage must clear/avoid hypothetical overlays');
assert(nav.includes("kind!=='action'"),'Tutor action-first projection must suppress the final action during non-action proof stages');

console.log('v319-r3ui-tango-contradiction-visual-integration.test.js: PASS');