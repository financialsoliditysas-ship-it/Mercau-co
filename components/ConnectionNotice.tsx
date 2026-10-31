'use client';
import {useEffect,useState} from 'react';
export default function ConnectionNotice(){
  const [offline,setOffline]=useState(false);
  useEffect(()=>{const update=()=>setOffline(navigator.onLine===false);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  return offline?<aside role="status" style={{padding:'10px 16px',background:'#fff4df',color:'#654d13',fontSize:13,lineHeight:1.5}}>Sin conexión. Puedes revisar lo ya cargado; reconecta para actualizar y confirmar pedidos.</aside>:null;
}
