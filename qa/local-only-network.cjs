const net=require('node:net');
const allowed=new Set(['127.0.0.1','localhost','::1','[::1]']);
const originalFetch=globalThis.fetch;
globalThis.fetch=function(input,options){
  const value=typeof input==='string'||input instanceof URL?String(input):input.url;
  const url=new URL(value);
  if(!allowed.has(url.hostname))return Promise.reject(Error('External services disabled in local integration verification.'));
  return originalFetch(input,options);
};
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
  const options=args[0];
  if(options&&typeof options==='object'&&!Array.isArray(options)){
    if(options.host&&!allowed.has(options.host))throw Error('External socket disabled in local integration verification.');
  }else if(typeof args[1]==='string'&&!allowed.has(args[1])){
    throw Error('External socket disabled in local integration verification.');
  }
  return connect.apply(this,args);
};
