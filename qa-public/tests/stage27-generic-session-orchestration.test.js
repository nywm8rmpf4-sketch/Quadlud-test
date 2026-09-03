'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','GitHub');
const Contract=require(path.join(ROOT,'game-contract.js'));
const Registry=require(path.join(ROOT,'game-registry.js'));
const Collection=require(path.join(ROOT,'game-ui-adapters.js'));
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const registry=fs.readFileSync(path.join(ROOT,'game-registry.js'),'utf8');
assert.strictEqual(Contract.VERSION,8);assert(Contract.OPTIONAL_CAPABILITIES.includes('uiLifecycle'));assert.strictEqual(Collection.VERSION,3);assert.deepStrictEqual([...Collection.REQUIRED_METHODS],['render','draw','reset']);
for(const id of Registry.IDS){assert.strictEqual(Registry.hasCapability(id,'uiLifecycle'),true);const lifecycle=Registry.requireCapability(id,'uiLifecycle');assert.strictEqual(typeof lifecycle.createAdapter,'function')}
function body(name,next='function '){const start=app.indexOf(`function ${name}(`);assert(start>=0,`${name} missing`);const end=app.indexOf(`\n${next}`,start+10);return app.slice(start,end<0?app.length:end)}
for(const name of ['renderInstalledSession','restorePuzzleSnapshot','closeWalkthrough','resetCurrent','resumeSaved','createWebGameUiAdapter','renderGameUi','drawGameUi','resetGameUi','keyboardInput']){const src=body(name);for(const id of Registry.IDS)assert(!src.includes(`'${id}'`)&&!src.includes(`"${id}"`),`${name} must not dispatch ${id}`)}
assert(app.includes("GameRegistry.requireCapability(game,'uiLifecycle')"));assert(app.includes('QuadludGameUiAdapters.createCollection(GameRegistry.IDS,createWebGameUiAdapter)'));assert(app.includes('function renderInstalledSession(c){return renderGameUi(c)}'));assert(app.includes('drawGameUi(current);'));assert(app.includes('if(!resetGameUi(current))return;'));assert(app.includes('historyInit(false);renderGameUi(c);if(postVictoryReviewActive(c))freezePostVictoryReviewTimer(c.postVictoryReview.officialSeconds);else startTimer'));assert(app.includes("GameRegistry.requireCapability(game,'sessionLifecycle')"));assert(app.includes("checkVictory:checkRegisteredVictory"));assert(!/function createWebGameUiAdapter\(game\)\{\s*if\(game===/.test(app));for(const id of Registry.IDS)assert(registry.includes('uiLifecycle:'));
console.log('Stage 27.3 generic session orchestration: OK');
