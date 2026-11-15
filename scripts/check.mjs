import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const nodes=new Map();const context2d=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
function node(key){if(!nodes.has(key))nodes.set(key,{value:key==='#charttype'?'candles':key==='#quantity'?'1':'',style:{},classList:{toggle(){},contains(){return false},add(){}},dataset:{},getBoundingClientRect:()=>({width:1000,height:500,left:0,top:0}),getContext:()=>context2d,showModal(){this.open=true},close(){this.open=false},focus(){},setPointerCapture(){}});return nodes.get(key)}
const sandbox={console,document:{querySelector:node,querySelectorAll:()=>[],body:node('body')},localStorage:{getItem:()=>null,setItem(){}},getComputedStyle:()=>({getPropertyValue:()=> '#222'}),devicePixelRatio:1,ResizeObserver:class{observe(){}},setInterval(){},setTimeout(){},clearTimeout(){}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);const run=s=>vm.runInContext(s,sandbox);
assert.equal(run('bars.length'),500);assert.equal(run('bars.at(-1).c'),67432.8);assert.equal(run('balance'),100000);
run("openOrder('buy'); $('#quantity').value='0.1'; $('#place-order').onclick()");assert.equal(run('orders.length'),1);assert.ok(Math.abs(run('balance')-93256.72)<.001);
run("openOrder('sell'); $('#quantity').value='0.2'; $('#place-order').onclick()");assert.equal(run('orders.length'),1);assert.match(run("$('#order-error').textContent"),/exceeds/);
run("$('#quantity').value='0.1'; $('#place-order').onclick()");assert.equal(run('orders.length'),2);assert.equal(run('balance'),100000);
run("selectMarket('EURUSD'); tf='1D'; generate()");assert.equal(run('market[0]'),'EURUSD');assert.equal(run('bars.at(-1).c'),1.08432);assert.ok(run('bars.every(b=>b.h>=b.c && b.h>=b.o && b.l<=b.c && b.l<=b.o)'));
run("openOrder('buy'); $('#quantity').value='-1'; $('#place-order').onclick()");assert.equal(run('orders.length'),2);
console.log('Passed: chart generation, OHLC validity, symbol/timeframe changes, buy/sell accounting, oversell and invalid quantity rejection.');
