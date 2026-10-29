"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CustomerOrderCard from './CustomerOrderCard';
import OrderReviewPresentation from './buyer/OrderReviewPresentation';
import './buyer/order-visual.css';
import { ArrowLeft, Plus } from 'lucide-react';
import './buyer/menu-visual.css';
import BackToAccount from './BackToAccount';
import PilotPublicationControls from './PilotPublicationControls';
import CatalogProductImage from './CatalogProductImage';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { PilotProduct } from '@/lib/restaurant-pilot';
import { BellRing, ExternalLink, LocateFixed, MapPin, RotateCcw, ShoppingCart, UserPlus, VolumeX } from 'lucide-react';
import './restaurant-pilot.css';
import { trackCommerceEvent } from '@/lib/commerce-tracking';
import { trackMetaEvent } from '@/lib/meta-pixel';

type LineSelection = { groupId:string;choiceIds:string[] };
type Line = { lineId:string;productId: string; quantity: number; selections:LineSelection[];note:string };
type Customer = { name: string; phone: string; address: string; neighborhood: string; instructions: string;
  deliveryLatitude: number | null; deliveryLongitude: number | null;
  deliveryLocationAccuracyM: number | null; deliveryLocationCapturedAt: string | null };
const EMPTY_CUSTOMER: Customer = { name: '', phone: '', address: '', neighborhood: '', instructions: '',
  deliveryLatitude: null, deliveryLongitude: null, deliveryLocationAccuracyM: null, deliveryLocationCapturedAt: null };
type Order = { id?: string; public_id: string; customer_name?: string; customer_phone?: string;
  address: string; neighborhood?: string; instructions?: string;
  delivery_latitude?: number | null; delivery_longitude?: number | null;
  lines: { name: string; unitPrice: number; quantity: number; selections?:{groupName:string;choices:{name:string;priceDelta:number}[]}[];note?:string }[];
  subtotal: number; delivery_fee: number; status: string; created_at: string;
  payment_method?: 'CASH' | 'BREB_QR'; payment_reference?: string | null; payment_reported_at?: string | null;
  delivery_mode?: 'MERCAU' | 'OWN';
  finance?: { payment_method: string; payment_status: string } | null;
  delivery: { public_id?: string; status: string; shipday_order_id?: string } | null;
  history?: { status: string; created_at: string }[] };
const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(Array.from(raw).map(character => character.charCodeAt(0)));
}
const statuses: Record<string, string> = { pending: 'Esperando confirmacion', accepted: 'En preparacion', rejected: 'No aceptado',
  ready: 'Listo para recoger', out_for_delivery: 'En camino', created: 'Solicitud de mensajero recibida', sent_to_shipday: 'Buscando mensajero',
  assigned: 'Mensajero asignado', picked_up: 'Recogido', in_transit: 'En camino', delivered: 'Entregado',
  cancelled: 'Cancelado', failed: 'Entrega no completada', integration_error: 'Despacho en revision' };

function createOrderChimeUrl() {
  const sampleRate = 22050;
  const duration = 7.2;
  const sampleCount = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => Array.from(value).forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index++) {
    const time = index / sampleRate;
    const pulseDuration = 0.6;
    const pulse = Math.floor(time / pulseDuration);
    const toneTime = time - pulse * pulseDuration;
    const audible = toneTime < 0.42;
    const attack = Math.min(1, toneTime / 0.025);
    const release = Math.max(0, 1 - Math.max(0, toneTime - 0.24) / 0.18);
    const envelope = audible ? attack * release : 0;
    const frequencies = [880, 1175, 988, 1318];
    const frequency = frequencies[pulse % frequencies.length];
    const fundamental = Math.sin(2 * Math.PI * frequency * toneTime);
    const harmonic = Math.sin(2 * Math.PI * frequency * 2 * toneTime) * 0.22;
    const sample = (fundamental + harmonic) * envelope * 0.72;
    view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export default function RestaurantPilot({ manager = false, restaurantId, businessName, embedded = false, returnPath = '', preview = false, visualMenu = false, coverImage = '', legacyPreview = false, previewDeliveryProfile }: {
  manager?: boolean; restaurantId?: string; businessName?: string; embedded?: boolean; returnPath?: string; preview?: boolean; visualMenu?: boolean; coverImage?: string;
  legacyPreview?:boolean;previewDeliveryProfile?:{name:string;phone:string;address:string;neighborhood:string;instructions:string};
}) {
  const live = Boolean(restaurantId);
  const title = businessName || 'Restaurante Mercado';
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [addedNoticeId, setAddedNoticeId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<PilotProduct[]>([]);
  const [fee, setFee] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<'MERCAU'|'OWN'>('MERCAU');
  const [category, setCategory] = useState('Todo');
  const [visibleCategory,setVisibleCategory]=useState('Todo');
  const categoriesRef=useRef<HTMLElement|null>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [customizing,setCustomizing]=useState<PilotProduct|null>(null);
  const [customSelections,setCustomSelections]=useState<Record<string,string[]>>({});
  const [customNote,setCustomNote]=useState('');
  const [customQuantity,setCustomQuantity]=useState(1);
  const [requestKey, setRequestKey] = useState('');
  const [checkout, setCheckout] = useState(false);
  const [review, setReview] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState('');
  const currentUser = useRef<string | null>(null);
  const ordersRequest = useRef(0);
  const knownManagerOrders = useRef<Set<string>>(new Set());
  const managerOrdersLoaded = useRef(false);
  const orderAlertAudio = useRef<HTMLAudioElement | null>(null);
  const orderAlertUrl = useRef<string | null>(null);
  const alertsEnabledRef = useRef(false);
  const highlightTimers = useRef<number[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushChecked, setPushChecked] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState('');
  const [newOrderIds, setNewOrderIds] = useState<string[]>([]);
  const [alertActivity, setAlertActivity] = useState('');
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BREB_QR'>('CASH');
  const [locationStatus, setLocationStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const checkoutRef = useRef<HTMLFormElement | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);
  const reviewSavedData = useRef(false);
  const menuViewTracked = useRef(false);
  const cartStorageKey = live && restaurantId ? `mercau:catalog-cart:${restaurantId}:v1` : '';
  const [cartRestored, setCartRestored] = useState(false);
  const previewSession = useRef('');
  useEffect(()=>{
    if(!visualMenu||checkout||currentOrderId||category!=='Todo')return;
    let frame=0;
    const update=()=>{
      frame=0;const nav=categoriesRef.current;if(!nav)return;
      const bounds=nav.getBoundingClientRect();if(bounds.top>innerHeight||bounds.bottom<0)return;
      const articles=nav.parentElement?.querySelectorAll<HTMLElement>('.pilot-menu article[data-menu-category]');
      const first=Array.from(articles||[]).find(article=>article.getBoundingClientRect().bottom>bounds.bottom+8);
      if(first)setVisibleCategory(first.dataset.menuCategory||'Todo');
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    schedule();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[visualMenu,checkout,currentOrderId,category,menu]);
  useEffect(()=>{
    const nav=categoriesRef.current;if(!visualMenu||!nav||nav.scrollWidth<=nav.clientWidth)return;
    const bounds=nav.getBoundingClientRect();if(bounds.top<0||bounds.bottom>innerHeight)return;
    const active=category==='Todo'?visibleCategory:category;
    Array.from(nav.querySelectorAll<HTMLButtonElement>('button')).find(button=>button.dataset.category===active)?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'});
  },[visibleCategory,category,visualMenu]);
  useEffect(() => {
    if (!cartStorageKey) { setCartRestored(true); return; }
    try {
      const saved = window.sessionStorage.getItem(cartStorageKey);
      if (saved) setCart(JSON.parse(saved) as Line[]);
    } catch { /* Ignore an invalid or unavailable browser store. */ }
    setCartRestored(true);
  }, [cartStorageKey]);
  useEffect(() => {
    if (!cartStorageKey || !cartRestored) return;
    try {
      if (cart.length) window.sessionStorage.setItem(cartStorageKey, JSON.stringify(cart));
      else window.sessionStorage.removeItem(cartStorageKey);
    } catch { /* Ordering continues even when browser storage is unavailable. */ }
  }, [cart, cartRestored, cartStorageKey]);
  useEffect(() => {
    if (!checkout) return;
    if (!review && reviewSavedData.current && checkoutRef.current) {
      reviewSavedData.current = false;
      if (checkoutRef.current.checkValidity()) { checkoutRef.current.requestSubmit(); return; }
    }
    const target = review ? reviewRef.current : checkoutRef.current;
    const frame = window.requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!review) {
        const firstMissing = Array.from(checkoutRef.current?.querySelectorAll<HTMLInputElement>('input[required]') || [])
          .find(input => !input.value.trim());
        window.setTimeout(() => firstMissing?.focus({ preventScroll: true }), 450);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [checkout, review, preview, legacyPreview]);
  useEffect(() => {
    if (preview || manager || !live || !menu.length || menuViewTracked.current || !restaurantId) return;
    menuViewTracked.current = true;
    trackCommerceEvent('Menu visto','ViewContent',{businessId:restaurantId,businessName:title});
  }, [live,manager,menu.length,restaurantId,title,preview]);
  useEffect(() => {
    const profile = session?.user.user_metadata?.delivery_profile;
    if (!profile || manager) return;
    setCustomer(current => ({ ...current,
      name: current.name || (typeof profile.name === 'string' ? profile.name : ''),
      phone: current.phone || (typeof profile.phone === 'string' ? profile.phone : ''),
      address: current.address || (typeof profile.address === 'string' ? profile.address : ''),
      neighborhood: current.neighborhood || (typeof profile.neighborhood === 'string' ? profile.neighborhood : ''),
      instructions: current.instructions || (typeof profile.instructions === 'string' ? profile.instructions : '') }));
  }, [session?.user.id, manager]);
  useEffect(() => {
    if (preview) {
      const id = '33333333-3333-4333-8333-333333333333';
      currentUser.current = id;
      setSession({user:{id,user_metadata:previewDeliveryProfile?{delivery_profile:previewDeliveryProfile}:{}},access_token:''} as Session);
      setAuthReady(true);
      return;
    }
    if (!supabase) { setAuthReady(true); setNotice('Las cuentas no estan configuradas.'); return; }
    let active = true;
    function updateSession(next: Session | null) {
      if (!active) return;
      if (currentUser.current !== (next?.user.id || null)) {
        ordersRequest.current++; setOrders([]); setCurrentOrderId(null); setOrdersError(''); setCheckout(false); setReview(false);
        knownManagerOrders.current.clear(); managerOrdersLoaded.current = false; setNewOrderIds([]); setAlertsEnabled(false);
        alertsEnabledRef.current = false; setAlertActivity('');
        setPushAvailable(false); setPushChecked(false); setPushEnabled(false); setPushPublicKey('');
        setCustomer(EMPTY_CUSTOMER);
        setLocationStatus('');
      }
      currentUser.current = next?.user.id || null;
      setSession(next); setAuthReady(true);
    }
    supabase.auth.getSession().then(({ data }) => updateSession(data.session)).catch(() => updateSession(null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => updateSession(next));
    return () => { active = false; currentUser.current = null; data.subscription.unsubscribe(); };
  }, [supabase, preview, previewDeliveryProfile]);
  useEffect(() => () => {
    highlightTimers.current.forEach(timer => window.clearTimeout(timer));
    orderAlertAudio.current?.pause();
    if (orderAlertUrl.current) URL.revokeObjectURL(orderAlertUrl.current);
  }, []);
  const playOrderAlert = useCallback(async () => {
    const audio = orderAlertAudio.current;
    if (!audio) throw new Error('Las alertas todavía no están activadas.');
    audio.currentTime = 0;
    await audio.play();
  }, []);
  const prepareOrderAlert = useCallback(() => {
    if (orderAlertAudio.current) return;
    const url = createOrderChimeUrl();
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 1;
    orderAlertUrl.current = url;
    orderAlertAudio.current = audio;
  }, []);
  const announceNewOrders = useCallback((fresh: Order[]) => {
    if (!fresh.length || !alertsEnabledRef.current) return;
    setAlertActivity(`Pedido nuevo detectado: ${fresh.map(order => order.public_id).join(', ')}`);
    void playOrderAlert().catch(() => {
      alertsEnabledRef.current = false;
      setAlertsEnabled(false);
      setNotice("El navegador bloqueó el sonido. Pulsa Activar alertas nuevamente.");
    });
    if ('vibrate' in navigator) navigator.vibrate([350, 150, 350, 150, 350, 150, 350]);
    const ids = fresh.map(order => order.public_id);
    setNewOrderIds(current => Array.from(new Set([...current, ...ids])));
    const timer = window.setTimeout(() => setNewOrderIds(current => current.filter(id => !ids.includes(id))), 30000);
    highlightTimers.current.push(timer);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(fresh.length === 1 ? 'Nuevo pedido en Mercáu' : `${fresh.length} pedidos nuevos en Mercáu`, {
        body: fresh.length === 1 ? `Pedido ${fresh[0].public_id} pendiente de confirmar.` : 'Abre el panel para revisarlos.',
        icon: '/logo-mercau.png',
      });
    }
  }, [playOrderAlert]);
  const api = useCallback(async (path: string, options: RequestInit = {}) => {
    const query = new URLSearchParams(path.replace(/^\?/, ''));
    if (restaurantId) query.set('restaurant', restaurantId);
    if (preview && !previewSession.current) {
      try { previewSession.current = sessionStorage.getItem('mercau.preview.session') || crypto.randomUUID(); sessionStorage.setItem('mercau.preview.session',previewSession.current); }
      catch { previewSession.current = crypto.randomUUID(); }
    }
    const response = await fetch((preview ? '/api/comprador/prueba-pedidos?' : '/api/piloto/restaurante?') + query.toString(), { ...options, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(preview ? {'x-preview-session':previewSession.current} : session ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo completar la solicitud.');
    return result;
  }, [session, restaurantId, preview]);
  const pushApi = useCallback(async (options: RequestInit = {}) => {
    const business = restaurantId || 'restaurante-mercado';
    const response = await fetch(`/api/push/subscription?business=${encodeURIComponent(business)}`, { ...options, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo configurar la notificación.');
    return result;
  }, [session, restaurantId]);
  useEffect(() => {
    if (!manager || !session) return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) { setPushAvailable(false); setPushChecked(true); return; }
    pushApi().then(result => {
      setPushAvailable(result.available === true);
      setPushEnabled(result.subscribed === true && Notification.permission === 'granted');
      setPushPublicKey(typeof result.publicKey === 'string' ? result.publicKey : '');
    }).catch(() => setPushAvailable(false)).finally(() => setPushChecked(true));
  }, [manager, session, pushApi]);
  useEffect(() => {
    if (manager) return;
    api('?mode=menu').then(r => { setMenu(r.menu); setFee(r.fee); setEnabled(r.enabled); setDeliveryMode(r.deliveryMode || 'MERCAU'); })
      .catch(e => setNotice(e.message));
  }, [api, manager]);
  const refresh = useCallback(async () => {
    if (!session || (!manager && !currentOrderId)) return;
    const userId = session.user.id;
    const requestId = ++ordersRequest.current;
    try {
      const r = await api(manager ? '?mode=manager' : '?mode=customer');
      if (currentUser.current === userId && ordersRequest.current === requestId) {
        const nextOrders = r.orders as Order[];
        if (manager) {
          const ids = new Set(nextOrders.map(order => order.public_id));
          if (managerOrdersLoaded.current) {
            announceNewOrders(nextOrders.filter(order => !knownManagerOrders.current.has(order.public_id)));
          } else {
            managerOrdersLoaded.current = true;
          }
          knownManagerOrders.current = ids;
          setAlertActivity(current => current.startsWith('Pedido nuevo detectado:') ? current : `Última revisión: ${new Date().toLocaleTimeString('es-CO')}`);
        }
        setOrders(nextOrders); setOrdersError('');
      }
    } catch {
      if (currentUser.current === userId && ordersRequest.current === requestId) setOrdersError('No se pudo actualizar el seguimiento. Conservamos la última información recibida.');
    }
  }, [api, manager, session, currentOrderId, announceNewOrders]);
  useEffect(() => {
    refresh();
    if (!session || (!manager && !currentOrderId)) return;
    const timer = setInterval(refresh, 12000);
    return () => clearInterval(timer);
  }, [refresh, session, manager, currentOrderId]);
  useEffect(() => {
    if (!manager || !session || !('serviceWorker' in navigator)) return;
    const receivePush = (event: MessageEvent) => {
      if (event.data?.type !== 'MERCAU_NEW_ORDER_PUSH') return;
      void refresh();
      if (!alertsEnabledRef.current) return;
      setAlertActivity(`Push recibido${event.data.orderId ? `: ${event.data.orderId}` : ''}. Actualizando pedidos y reproduciendo alarma.`);
      void playOrderAlert().catch(() => {
        setNotice('El pedido se actualizó, pero el navegador bloqueó el sonido interno. Revisa el volumen y los permisos de notificación.');
      });
      if ('vibrate' in navigator) navigator.vibrate([700, 180, 700, 180, 900, 180, 900]);
    };
    navigator.serviceWorker.addEventListener('message', receivePush);
    return () => navigator.serviceWorker.removeEventListener('message', receivePush);
  }, [manager, session, refresh, playOrderAlert]);
  useEffect(() => {
    if (!manager || !session) return;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [manager, session, refresh]);
  useEffect(() => {
    if (currentOrderId) document.getElementById('mis-pedidos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentOrderId]);
  useEffect(() => {
    if (!manager || !orders.length) return;
    const requested = new URLSearchParams(window.location.search).get('pedido');
    if (!requested || !orders.some(order => order.public_id === requested)) return;
    setNewOrderIds(current => Array.from(new Set([...current, requested])));
    window.requestAnimationFrame(() => document.getElementById(`pedido-${requested}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [manager, orders]);
  const pendingOrders = manager ? orders.filter(order => order.status === 'pending').length : 0;
  useEffect(() => {
    if (!manager) return;
    document.title = pendingOrders ? `(${pendingOrders}) Pedidos | Mercáu` : 'Pedidos | Mercáu';
    return () => { document.title = 'Mercáu'; };
  }, [manager, pendingOrders]);
  async function toggleAlerts() {
    if (alertsEnabled) {
      setAlertsEnabled(false);
      alertsEnabledRef.current = false;
      orderAlertAudio.current?.pause();
      setNotice('Alertas sonoras pausadas.');
      return;
    }
    try {
      prepareOrderAlert();
      await playOrderAlert();
      setAlertsEnabled(true);
      alertsEnabledRef.current = true;
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      setNotice('Alertas activadas. Escucharás una segunda prueba automática en 4 segundos.');
      window.setTimeout(() => {
        if (!alertsEnabledRef.current) return;
        void playOrderAlert().then(() => setNotice('Prueba automática completada. Las alertas siguen activas.')).catch(() => {
          alertsEnabledRef.current = false;
          setAlertsEnabled(false);
          setNotice('El navegador bloqueó la prueba automática. Mantén esta página visible y activa nuevamente las alertas.');
        });
      }, 4000);
    } catch {
      setNotice('El navegador no permitió activar el sonido. Revisa el volumen y los permisos del sitio.');
    }
  }
  async function toggleBackgroundPush() {
    if (!session || pushBusy) return;
    setPushBusy(true); setNotice('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
        throw new Error('Este navegador no admite notificaciones en segundo plano.');
      const registration = await navigator.serviceWorker.register('/mercau-sw.js', { scope: '/' });
      if (pushEnabled) {
        const current = await registration.pushManager.getSubscription();
        await pushApi({ method: 'DELETE', body: JSON.stringify({ endpoint: current?.endpoint || '' }) });
        await current?.unsubscribe();
        setPushEnabled(false); setNotice('Notificaciones en segundo plano desactivadas en este dispositivo.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('No autorizaste las notificaciones. Puedes habilitarlas desde los permisos del sitio.');
      prepareOrderAlert();
      await playOrderAlert();
      alertsEnabledRef.current = true;
      setAlertsEnabled(true);
      const status = pushPublicKey ? { publicKey: pushPublicKey } : await pushApi();
      if (!status.publicKey) throw new Error('Las notificaciones todavía no están disponibles.');
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: applicationServerKey(status.publicKey),
      });
      await pushApi({ method: 'POST', body: JSON.stringify(subscription.toJSON()) });
      setPushEnabled(true); setPushAvailable(true);
      await registration.showNotification('Notificaciones de Mercáu activadas', {
        body: 'Este dispositivo recibirá los pedidos nuevos del negocio.', icon: '/logo-mercau.png', tag: 'mercau-push-ready',
      });
      setNotice('Notificaciones y alarma reforzada activadas. Mantén el volumen del teléfono alto.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo activar la notificación.');
    } finally { setPushBusy(false); }
  }
  async function signOut() {
    try {
      if (pushEnabled && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const current = await registration?.pushManager.getSubscription();
        await pushApi({ method: 'DELETE', body: JSON.stringify({ endpoint: current?.endpoint || '' }) });
        await current?.unsubscribe();
      }
    } catch { /* The session is still closed even if browser cleanup fails. */ }
    await supabase?.auth.signOut();
  }
  async function login(event: FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setNotice('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setNotice('No se pudo entrar. Revisa tu correo y contrasena.');
    } catch { setNotice('No se pudo conectar. Intenta de nuevo.'); }
    finally { setPassword(''); setBusy(false); }
  }
  function quantity(lineId: string, change: number) {
    setCart(current => {
      const existing = current.find(l => l.lineId === lineId);
      const count = Math.min(10, Math.max(0, (existing?.quantity || 0) + change));
      return current.flatMap(line=>line.lineId!==lineId?[line]:count?[{...line,quantity:count}]:[]);
    });
    setRequestKey('');
  }
  function openCustomization(product:PilotProduct) {
    if(!preview&&live&&restaurantId)trackCommerceEvent('Producto visto','ViewContent',{businessId:restaurantId,businessName:title,productId:product.id,productName:product.name,value:product.price});
    setCustomizing(product);setCustomNote('');setCustomQuantity(1);
    setCustomSelections(Object.fromEntries(product.optionGroups.map(group=>[group.id,group.choices.filter(choice=>choice.defaultSelected).map(choice=>choice.id)])));
  }
  function selectChoice(groupId:string,choiceId:string,type:'single'|'multiple',max:number) {
    setCustomSelections(current=>{
      const selected=current[groupId] || [];
      const next=type==='single'?[choiceId]:selected.includes(choiceId)?selected.filter(id=>id!==choiceId):selected.length<max?[...selected,choiceId]:selected;
      return {...current,[groupId]:next};
    });
  }
  function addCustomizedProduct() {
    if(!customizing)return;
    const incomplete=customizing.optionGroups.find(group=>{
      const count=(customSelections[group.id] || []).length;
      return count<group.minSelections || count>group.maxSelections || (group.required && count===0);
    });
    if(incomplete){setNotice(`Completa “${incomplete.name}” antes de agregar el producto.`);return;}
    setCart(current=>[...current,{lineId:crypto.randomUUID(),productId:customizing.id,quantity:customQuantity,
      selections:customizing.optionGroups.map(group=>({groupId:group.id,choiceIds:customSelections[group.id] || []})),note:customNote.trim()}]);
    if(!preview&&live&&restaurantId)trackCommerceEvent('Producto agregado','AddToCart',{businessId:restaurantId,businessName:title,productId:customizing.id,productName:customizing.name,value:(customizing.price+customizing.optionGroups.reduce((sum,group)=>sum+group.choices.filter(choice=>(customSelections[group.id] || []).includes(choice.id)).reduce((subtotal,choice)=>subtotal+choice.priceDelta,0),0))*customQuantity,quantity:customQuantity});
    setCustomizing(null);setRequestKey('');setNotice('Producto agregado a tu pedido.');
    if(visualMenu)setAddedNoticeId(value=>value+1);
  }
  function configuredUnitPrice(line:Line) {
    const product=menu.find(item=>item.id===line.productId);if(!product)return 0;
    return product.price+line.selections.reduce((sum,selection)=>sum+(product.optionGroups.find(group=>group.id===selection.groupId)?.choices.filter(choice=>selection.choiceIds.includes(choice.id)).reduce((choiceSum,choice)=>choiceSum+choice.priceDelta,0) || 0),0);
  }
  function selectedLineOptions(line:Line) {
    const product=menu.find(item=>item.id===line.productId);
    return line.selections.flatMap(selection=>{
      const group=product?.optionGroups.find(item=>item.id===selection.groupId);
      return (group?.choices || []).filter(choice=>selection.choiceIds.includes(choice.id)).map(choice=>({groupName:group?.name || 'Opción',...choice}));
    });
  }
  function captureDeliveryLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Este navegador no permite obtener la ubicación. Escribe la dirección y una referencia.');
      return;
    }
    setLocating(true); setLocationStatus('Buscando tu ubicación actual...');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setCustomer(current => ({ ...current,
        deliveryLatitude: Number(coords.latitude.toFixed(7)),
        deliveryLongitude: Number(coords.longitude.toFixed(7)),
        deliveryLocationAccuracyM: Math.round(coords.accuracy),
        deliveryLocationCapturedAt: new Date().toISOString() }));
      setRequestKey(''); setLocationStatus('Ubicación guardada. Revisa el punto antes de continuar.'); setLocating(false);
    }, error => {
      const messages: Record<number,string> = { 1:'No autorizaste la ubicación. Puedes escribir la dirección y una referencia.',
        2:'El teléfono no pudo determinar la ubicación. Intenta de nuevo en un lugar abierto.',
        3:'La ubicación tardó demasiado. Intenta nuevamente.' };
      setLocationStatus(messages[error.code] || 'No se pudo obtener la ubicación. Escribe la dirección y una referencia.');
      setLocating(false);
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  }
  function clearDeliveryLocation() {
    setCustomer(current => ({ ...current, deliveryLatitude:null, deliveryLongitude:null,
      deliveryLocationAccuracyM:null, deliveryLocationCapturedAt:null }));
    setRequestKey(''); setLocationStatus('');
  }
  const customerMapsUrl = customer.deliveryLatitude !== null && customer.deliveryLongitude !== null
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${customer.deliveryLatitude},${customer.deliveryLongitude}`)}` : '';
  const subtotal = cart.reduce((sum, l) => sum + configuredUnitPrice(l) * l.quantity, 0);
  const currentOrder = orders.find(order => order.public_id === currentOrderId);
  const showPaymentInstructions = currentOrder?.status !== 'rejected' && currentOrder?.delivery?.status !== 'cancelled';
  async function submit() {
    setBusy(true); setNotice('');
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      const r = await api('', { method: 'POST', body: JSON.stringify({ ...customer, lines: cart, paymentMethod, requestKey: key, confirmed: true }) });
      setCart([]); setCheckout(false); setReview(false); setRequestKey('');
      setCurrentOrderId(r.public_id);
      if(!preview&&live&&restaurantId){
        trackCommerceEvent('Solicitud de pedido recibida','Lead',{businessId:restaurantId,businessName:title,value:subtotal+fee,quantity:cart.reduce((sum,line)=>sum+line.quantity,0)});
        trackMetaEvent('OrderSubmitted',{content_ids:cart.map(line=>line.productId),content_name:title,content_type:'product',currency:'COP',value:subtotal+fee,num_items:cart.reduce((sum,line)=>sum+line.quantity,0),order_id:r.public_id},true);
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : 'No se pudo enviar el pedido.'); }
    finally { setBusy(false); }
  }
  async function action(o: Order, value: string) {
    setBusy(true); setNotice('');
    try {
      const r = await api('', { method: 'PATCH', body: JSON.stringify({ id: o.id, action: value }) });
      setNotice(r.message); await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : 'No se pudo actualizar.'); }
    finally { setBusy(false); }
  }
  return <div className={`pilot${preview?' buyer-pilot-preview':''}${(preview||visualMenu)&&checkout?' checkout-open':''}${visualMenu&&!manager?' pilot-visual-menu':''}${visualMenu&&currentOrderId?' order-tracking-open':''}`}>
    {!embedded && <header className="pilot-header"><a href="/" aria-label="Volver a Mercau"><img src="/logo-mercau.png" alt="Mercau" /></a><span>{manager ? 'Panel de mi negocio' : title}</span>
      {preview ? <a href="/comprar">Volver al Inicio</a> : <BackToAccount />}{session && !preview && <button onClick={signOut}>Cerrar sesion</button>}</header>}
    {preview && <p className="pilot-preview-banner">Vista de prueba · Datos ficticios. No se cobra dinero ni se despachan pedidos.</p>}
    {!live && <div className="pilot-test">Restaurante ficticio de prueba. No se preparan productos. Si eliges Bre-B, la transferencia sí mueve dinero real a Mercáu y debe acordarse previamente.</div>}
    {notice && !(preview&&checkout) && <p key={visualMenu?addedNoticeId:undefined} role="status" className={visualMenu&&notice==='Producto agregado a tu pedido.'?'pilot-notice menu-added-toast':'pilot-notice'}>{notice}</p>}
    {ordersError && <p role="status" className="pilot-notice">{ordersError}</p>}
    {!manager && !preview && <p><a href="/mi-cuenta/pedidos">Ver mis pedidos</a></p>}
    {!manager && session && currentOrderId && <section id="mis-pedidos" className="pilot-orders" aria-label="Seguimiento de tu pedido actual"><h2>Tu pedido actual</h2>
      <button onClick={refresh} disabled={busy}>Actualizar seguimiento</button>
      {preview && <div className="pilot-preview-actions" aria-label="Simular estados de prueba">{[['accepted','Simular aceptación'],['in_transit','Simular en camino'],['delivered','Simular entrega'],['failed','Simular novedad']].map(([status,label])=><button key={status} disabled={busy} onClick={async()=>{try{await api('',{method:'PATCH',body:JSON.stringify({publicId:currentOrderId,status})});await refresh();}catch{setNotice('No se pudo simular el estado.');}}}>{label}</button>)}</div>}
      {currentOrder ? <><CustomerOrderCard order={currentOrder} visual={visualMenu} />{showPaymentInstructions && currentOrder.payment_method === 'BREB_QR' && <p className="pilot-payment-info">Elegiste transferencia contra entrega. El mensajero te mostrará el QR de Mercáu. Verifica que el destinatario sea Financial Solidity S.A.S.</p>}{showPaymentInstructions && currentOrder.payment_method === 'CASH' && <p className="pilot-payment-info">Elegiste efectivo contra entrega. Ten disponible el valor exacto del pedido.</p>}</> : <p role="status">Pedido {currentOrderId} recibido. Consultando su estado...</p>}
      <button onClick={() => { ordersRequest.current++; setCurrentOrderId(null); setOrders([]); setOrdersError(''); setNotice(''); }}>Hacer otro pedido</button>
    </section>}
    {manager && session && !live && <PilotPublicationControls accessToken={session.access_token} />}
    {!authReady && <p>Cargando tu acceso...</p>}
    {authReady && !session && <section className="pilot-login"><h2>{manager ? 'Entrar al panel de mi negocio' : live ? 'Entra para hacer tu pedido' : 'Entra para hacer tu pedido de prueba'}</h2>
      {live && <p>Puedes mirar todo el menú sin registrarte. Para confirmar el pedido, entra o crea una cuenta gratuita.</p>}
      <form onSubmit={login}><label>Correo<input autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Contraseña<input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <div className="pilot-login-actions"><button className="pilot-primary" disabled={busy || !supabase}>Entrar</button>
          {live && <a className="pilot-create-account" href={`/mi-cuenta?mode=register&intent=buyer&returnTo=${encodeURIComponent(returnPath || '/')}`}><UserPlus size={18} aria-hidden="true" />Crear mi cuenta para pedir</a>}</div></form>
      {!live && <p>Acceso solo para cuentas invitadas a esta prueba.</p>}</section>}
    {!manager && !currentOrderId && <>
      {visualMenu && !checkout && <section className="menu-visual-identity" aria-label="Información del restaurante">
        {coverImage && <div className="menu-visual-cover"><img src={coverImage} alt=""/></div>}
        <a className="menu-visual-back" href="/comprar" aria-label="Volver al Inicio"><ArrowLeft size={25}/></a>
        <div className="menu-visual-title"><h1>{title}</h1><p>Menú</p></div>
      </section>}
      {!embedded && <section className="pilot-intro"><h1>{title}</h1>{!live && <><p>Hamburguesas, parrilla y malteadas · Nechi</p><p>Horario de referencia: 5:00 p. m. a 10:00 p. m.</p></>}
        {!enabled && <p>Pedidos pausados.</p>}</section>}
      {live && <p className="pilot-coverage">Solo casco urbano de Nechí. Puedes pagar en efectivo contra entrega o mediante Bre-B. El negocio debe confirmar tu pedido.</p>}
      {live && deliveryMode==='OWN' && <p className="pilot-delivery-owner"><strong>Entrega realizada por el negocio.</strong> El pedido será llevado por el equipo de {title}, no por un domiciliario de Mercáu.</p>}
      {embedded && !enabled && <p role="status">Pedidos pausados.</p>}
      {!menu.length && <p>No hay productos disponibles para pedir.</p>}
      <nav ref={categoriesRef} className="pilot-categories" aria-label="Categorias del menu">{['Todo', ...Array.from(new Set(menu.map(p => p.category)))].map(c =>
        <button key={c} data-category={c} aria-pressed={c === (visualMenu&&category==='Todo'?visibleCategory:category)} onClick={() => {setCategory(c);setVisibleCategory(c);if(visualMenu)requestAnimationFrame(()=>categoriesRef.current?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}}>{c}</button>)}</nav>
      <div className={(preview||visualMenu)&&checkout?'pilot-shop pilot-checkout-active':'pilot-shop'}><section className="pilot-menu">{menu.filter(p => category === 'Todo' || p.category === category).map(p => {
        const count = cart.filter(l => l.productId === p.id).reduce((sum,line)=>sum+line.quantity,0);
        return <article key={p.id} data-menu-category={p.category}>
          {visualMenu && <button type="button" className="menu-product-open" aria-label={`Ver detalle de ${p.name}`} onClick={()=>openCustomization(p)} disabled={!enabled || busy}/>}
          <div className="pilot-product-image aspect-[4/3] w-full overflow-hidden bg-gray-100"><CatalogProductImage name={p.name} imageUrl={p.image} /></div><div className="pilot-product-body"><h2>{p.name}</h2>{p.description && <p className="text-sm menu-product-description">{p.description}</p>}<p className="pilot-product-price">{money(p.price)}</p>
          {p.optionGroups.length>0 && <p className="pilot-customizable">Personalizable</p>}
          {count>0 && <p className="text-center text-sm font-bold text-[#D82016]">{count} en tu pedido</p>}
          <button className="pilot-primary w-full" aria-label={visualMenu?`Agregar ${p.name}`:undefined} disabled={!enabled || busy} onClick={()=>openCustomization(p)}>{visualMenu?<Plus size={24}/>:p.optionGroups.length?'Personalizar y agregar':'Agregar al pedido'}</button></div></article>;
      })}</section>
      <aside className="pilot-cart" id="tu-pedido"><div hidden={(preview||visualMenu)&&checkout}><h2>Tu pedido</h2>{!cart.length && (visualMenu?<div className="menu-empty-cart"><ShoppingCart size={30} aria-hidden="true"/><p>Tu pedido está vacío</p></div>:<p>Elige productos del menu.</p>)}{cart.map(l => {const product=menu.find(p=>p.id===l.productId);return <div key={l.lineId} className="pilot-cart-line"><p><strong>{l.quantity} x {product?.name}</strong> · {money(configuredUnitPrice(l)*l.quantity)}</p>
        {selectedLineOptions(l).map(choice=><p key={choice.id} className="pilot-line-detail">{choice.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</p>)}
        {l.note && <p className="pilot-line-detail">Observación: {l.note}</p>}
        <div className="pilot-quantity"><button disabled={busy} aria-label={`Quitar ${product?.name}`} onClick={()=>quantity(l.lineId,-1)}>-</button><output>{l.quantity}</output><button disabled={busy || l.quantity>=10} aria-label={`Agregar ${product?.name}`} onClick={()=>quantity(l.lineId,1)}>+</button></div></div>;})}
        {cart.length>0&&<><p>Productos <strong>{money(subtotal)}</strong></p><p>Domicilio <strong>{money(fee)}</strong></p><p>Total <strong>{money(subtotal + fee)}</strong></p></>}
        <button className="pilot-primary" disabled={!cart.length || !enabled || busy} onClick={() => {
          if (!session) { document.querySelector<HTMLElement>('.pilot-login')?.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
          if(!preview&&live&&restaurantId)trackCommerceEvent('Carrito iniciado','InitiateCheckout',{businessId:restaurantId,businessName:title,value:subtotal+fee,quantity:cart.reduce((sum,line)=>sum+line.quantity,0)});
          reviewSavedData.current = visualMenu && Boolean(session?.user.user_metadata?.delivery_profile);
          setCheckout(true); setReview(false);
        }}>{session ? 'Continuar' : 'Entrar o crear cuenta para continuar'}</button>
        {!session && <p>Tu selección quedará guardada temporalmente en este celular mientras creas la cuenta.</p>}
        </div>
        {checkout && (!review ? <form ref={checkoutRef} className="pilot-checkout-form" onSubmit={e => { e.preventDefault(); if(!preview&&live&&restaurantId)trackCommerceEvent('Pedido revisado','ReviewOrder',{businessId:restaurantId,businessName:title,value:subtotal+fee,quantity:cart.reduce((sum,line)=>sum+line.quantity,0)},true); setReview(true); }}>
          <h3>Datos de entrega</h3>
          {([['name','Nombre'], ['phone','Celular'], ['address','Direccion de entrega'], ['neighborhood','Barrio / sector'], ['instructions','Referencia (opcional)']] as const).map(([key,label]) =>
            <label key={key}>{label}<input maxLength={key === 'instructions' ? 500 : 240} type={key === 'phone' ? 'tel' : 'text'} required={key !== 'instructions'}
              value={customer[key]} onChange={e => { setCustomer(c => ({ ...c, [key]: e.target.value })); setRequestKey(''); }} /></label>)}
          <section className="rounded-md border border-gray-200 bg-gray-50 p-4" aria-labelledby="catalog-delivery-location">
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#D82016]" aria-hidden="true" /><div>
              <h3 id="catalog-delivery-location" className="font-bold">Ubicación exacta de entrega</h3>
              <p className="text-sm">Úsala si la calle no aparece en el mapa o no tiene nomenclatura.</p>
            </div></div>
            {customerMapsUrl ? <div className="mt-3 rounded-md bg-white p-3"><strong className="text-emerald-700">Ubicación guardada</strong>
              <p className="text-sm">Precisión aproximada: {customer.deliveryLocationAccuracyM ?? 0} metros.</p>
              {(customer.deliveryLocationAccuracyM ?? 0) > 50 && <p className="text-sm font-bold text-amber-700">La precisión es baja. Acércate a un lugar abierto y vuelve a tomarla.</p>}
              <div className="mt-3 flex flex-wrap gap-2"><a href={customerMapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#D82016] px-4 font-bold text-white"><ExternalLink className="h-4 w-4" aria-hidden="true" />Revisar en Google Maps</a>
                <button type="button" onClick={clearDeliveryLocation} className="inline-flex min-h-11 items-center gap-2"><RotateCcw className="h-4 w-4" aria-hidden="true" />Volver a tomar</button></div>
            </div> : <button type="button" disabled={locating} onClick={captureDeliveryLocation} className="pilot-primary mt-3 inline-flex items-center justify-center gap-2"><LocateFixed className="h-5 w-5" aria-hidden="true" />{locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}</button>}
            {locationStatus && <p role="status" className="mt-2 text-sm font-bold">{locationStatus}</p>}
            <p className="mt-2 text-xs text-gray-600">Mercáu guarda este punto para realizar la entrega. No sigue tu recorrido.</p>
          </section>
          <fieldset className="pilot-payment-choice"><legend>Pago contra entrega</legend><label><input type="radio" name="payment" checked={paymentMethod === 'CASH'} onChange={() => { setPaymentMethod('CASH'); setRequestKey(''); }}/> Pagar en efectivo</label><label><input type="radio" name="payment" checked={paymentMethod === 'BREB_QR'} onChange={() => { setPaymentMethod('BREB_QR'); setRequestKey(''); }}/> Pagar por transferencia Bre-B</label></fieldset>
          <p>{live ? 'Solo casco urbano de Nechí.' : 'Solo casco urbano de Nechi. La prueba no recauda dinero real.'}</p>
          <button className="pilot-primary" disabled={busy}>Revisar solicitud</button></form> : <section ref={reviewRef} className="pilot-review">{visualMenu?<OrderReviewPresentation businessName={title} lines={cart.map(line=>({...line,name:menu.find(item=>item.id===line.productId)?.name || '',unitPrice:configuredUnitPrice(line),options:selectedLineOptions(line)}))} subtotal={subtotal} fee={fee} customer={customer} paymentMethod={paymentMethod} hasPoint={Boolean(customerMapsUrl)} live={live} busy={busy} canConfirm={enabled&&Boolean(session)} onConfirm={()=>void submit()} onEdit={()=>setReview(false)}/>:<><h3>Revisa tu solicitud</h3>
          <p>{customer.name} · {customer.phone}</p><p>{customer.address}, {customer.neighborhood}</p><p>{customer.instructions}</p>
          {customerMapsUrl && <p className="font-bold text-emerald-700">Ubicación exacta agregada</p>}
          <div className="pilot-review-lines"><h4>Resumen del pedido</h4>{cart.map(line=>{const product=menu.find(item=>item.id===line.productId);return <div key={line.lineId} className="pilot-cart-line"><p><strong>{line.quantity} x {product?.name}</strong> · {money(configuredUnitPrice(line)*line.quantity)}</p>{selectedLineOptions(line).map(choice=><p key={choice.id} className="pilot-line-detail">{choice.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</p>)}{line.note&&<p className="pilot-line-detail">Observación: {line.note}</p>}</div>})}</div>
          <p>Productos: <strong>{money(subtotal)}</strong></p><p>Domicilio: <strong>{money(fee)}</strong></p><p>{live ? 'Total a pagar' : 'Total de prueba'}: <strong>{money(subtotal + fee)}</strong></p><p>Pago contra entrega: {paymentMethod === 'BREB_QR' ? 'transferencia Bre-B; el mensajero mostrará el QR' : 'efectivo'}.</p><p>El restaurante debe confirmar antes del despacho.</p>
          <button disabled={busy || !enabled || !session} className="pilot-primary" onClick={()=>void submit()}>{busy ? 'Guardando...' : live ? 'Confirmar pedido' : 'Confirmar pedido de prueba'}</button>
          <button disabled={busy} onClick={() => setReview(false)}>Corregir datos</button></>}</section>)}
      </aside></div>
      {customizing && <div className="pilot-customizer-backdrop" role="presentation" onMouseDown={()=>setCustomizing(null)}><section className="pilot-customizer" role="dialog" aria-modal="true" aria-labelledby="customizer-title" onMouseDown={event=>event.stopPropagation()}>
        <div className="pilot-customizer-heading"><div><p>Personaliza tu pedido</p><h2 id="customizer-title">{customizing.name}</h2><strong>Desde {money(customizing.price)}</strong></div><button type="button" onClick={()=>setCustomizing(null)} aria-label="Cerrar personalización">×</button></div>
        {visualMenu && customizing.description && <p className="menu-product-full-description">{customizing.description}</p>}
        {customizing.optionGroups.map(group=><fieldset key={group.id}><legend>{group.name}{group.required?' *':''}</legend><p className="pilot-option-help">{group.type==='single'?'Elige una opción':`Puedes elegir hasta ${group.maxSelections}`}</p>
          {group.choices.map(choice=>{const checked=(customSelections[group.id] || []).includes(choice.id);return <label key={choice.id}><input type={group.type==='single'?'radio':'checkbox'} name={`choice-${group.id}`} checked={checked} onChange={()=>selectChoice(group.id,choice.id,group.type,group.maxSelections)}/><span>{choice.name}</span>{choice.priceDelta>0&&<strong>+ {money(choice.priceDelta)}</strong>}</label>;})}
        </fieldset>)}
        <label className="pilot-item-note">Observación para este producto<textarea maxLength={240} rows={3} value={customNote} onChange={e=>setCustomNote(e.target.value)} placeholder="Ej: carne bien asada y salsas aparte"/><small>{customNote.length}/240</small></label>
        <div className="pilot-customizer-footer"><div className="pilot-quantity"><button type="button" disabled={customQuantity<=1} onClick={()=>setCustomQuantity(value=>Math.max(1,value-1))}>-</button><output>{customQuantity}</output><button type="button" disabled={customQuantity>=10} onClick={()=>setCustomQuantity(value=>Math.min(10,value+1))}>+</button></div><button type="button" className="pilot-primary" onClick={addCustomizedProduct}>Agregar · {money((customizing.price+customizing.optionGroups.reduce((sum,group)=>sum+group.choices.filter(choice=>(customSelections[group.id] || []).includes(choice.id)).reduce((subtotal,choice)=>subtotal+choice.priceDelta,0),0))*customQuantity)}</button></div>
      </section></div>}
    </>}
    {!manager && cart.length > 0 && !checkout && <a className="pilot-mobile-cart" href="#tu-pedido" aria-label={`Ver pedido, ${cart.reduce((sum,line)=>sum+line.quantity,0)} productos, total ${money(subtotal+fee)}`}><ShoppingCart size={21} aria-hidden="true" /><span>Ver pedido</span><span className="pilot-cart-count">{cart.reduce((sum,line)=>sum+line.quantity,0)}</span><strong>{money(subtotal + fee)}</strong></a>}
    {session && manager && <section id="mis-pedidos" className="pilot-orders"><div className="pilot-orders-heading"><div><h1>Pedidos de mi negocio</h1><p>{pendingOrders ? `${pendingOrders} pendiente${pendingOrders === 1 ? '' : 's'} de confirmar` : 'No hay pedidos pendientes de confirmar'}</p></div><div className="pilot-alert-actions">
        <button type="button" className={pushEnabled ? 'pilot-alert-toggle active' : 'pilot-alert-toggle'} aria-pressed={pushEnabled} disabled={pushBusy || (!pushAvailable && !pushPublicKey)} onClick={toggleBackgroundPush}><BellRing size={18} />{pushBusy ? 'Configurando...' : pushEnabled ? 'Push y alarma activos' : 'Activar avisos de pedidos'}</button>
        <button type="button" className={alertsEnabled ? 'pilot-alert-toggle active' : 'pilot-alert-toggle'} aria-pressed={alertsEnabled} onClick={toggleAlerts}>{alertsEnabled ? <VolumeX size={18} /> : <BellRing size={18} />}{alertsEnabled ? 'Pausar sonido local' : 'Sonido en esta pantalla'}</button>
        <button onClick={refresh} disabled={busy}>Actualizar</button>
      </div></div>{pushChecked && !pushAvailable && <p className="pilot-alert-activity">Las notificaciones en segundo plano no están disponibles en este navegador. En iPhone, agrega Mercáu a la pantalla de inicio y ábrelo desde su icono.</p>}{pushEnabled && <p role="status" className="pilot-alert-activity"><BellRing size={16} /> Aviso persistente activo. El teléfono controla el volumen del push; para una alarma larga y más fuerte, deja este panel abierto en el dispositivo del negocio.</p>}{alertsEnabled && <p role="status" className="pilot-alert-activity"><BellRing size={16} /> {alertActivity || 'Alarma local activa. Esperando pedidos nuevos.'}</p>}{!orders.length && <p>No hay pedidos para mostrar.</p>}
      {orders.map(o => <article id={`pedido-${o.public_id}`} key={o.public_id} className={newOrderIds.includes(o.public_id) ? 'pilot-order-new' : undefined}>{newOrderIds.includes(o.public_id) && <p className="pilot-new-order-label"><BellRing size={17} /> Nuevo pedido</p>}<h2>{o.public_id}</h2><p>{new Date(o.created_at).toLocaleString('es-CO')}</p>
        <strong className="pilot-order-status">{statuses[o.delivery?.status || o.status] || 'Pedido en revision'}</strong><p className={o.finance?.payment_status === 'CONFIRMED' ? 'pilot-payment-confirmed' : ''}>Pago contra entrega: {o.payment_method === 'BREB_QR' ? 'transferencia Bre-B' : 'efectivo'}{o.finance?.payment_status === 'CONFIRMED' ? ' · Confirmado' : ''}</p>
        <ul>{o.lines.map((l,i) => <li key={i}><strong>{l.quantity} x {l.name} · {money(l.unitPrice * l.quantity)}</strong>{l.selections?.map(selection=>selection.choices.map(choice=><span key={`${selection.groupName}-${choice.name}`} className="pilot-order-option">{selection.groupName}: {choice.name}{choice.priceDelta>0&&<> <strong>+{money(choice.priceDelta)} c/u</strong></>}</span>))}{l.note&&<span className="pilot-order-option">Observación: {l.note}</span>}</li>)}</ul>
        <p>Productos: {money(o.subtotal)} · Domicilio: {money(o.delivery_fee)} · Total: {money(o.subtotal + o.delivery_fee)}</p>
        <p>Entrega: {o.address}</p>
        {manager && <><p>{o.customer_name} · {o.customer_phone}</p><p>{o.neighborhood} · {o.instructions}</p>
          {o.delivery_latitude !== null && o.delivery_latitude !== undefined && o.delivery_longitude !== null && o.delivery_longitude !== undefined &&
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${o.delivery_latitude},${o.delivery_longitude}`)}&travelmode=driving`} target="_blank" rel="noreferrer" className="font-bold text-[#D82016]">Abrir entrega en Google Maps</a>}
          {o.status === 'pending' && <div className="pilot-actions"><button className="pilot-primary" disabled={busy} onClick={() => action(o, 'accepted')}>Aceptar pedido</button>
            <button disabled={busy} onClick={() => action(o, 'rejected')}>Rechazar pedido</button></div>}
          {o.status === 'accepted' && <button disabled={busy} className="pilot-primary" onClick={() => action(o, 'ready')}>{o.delivery_mode==='OWN'?'Marcar listo para entregar':'Solicitar domiciliario Mercáu'}</button>}
          {o.delivery_mode==='OWN' && o.status==='ready' && <button disabled={busy} className="pilot-primary" onClick={()=>action(o,'out_for_delivery')}>Marcar pedido en camino</button>}
          {o.delivery_mode==='OWN' && o.status==='out_for_delivery' && <button disabled={busy} className="pilot-primary" onClick={()=>action(o,'delivered')}>Marcar pedido entregado</button>}
          {o.delivery?.public_id && <p>Envio {o.delivery.public_id} · Shipday {o.delivery.shipday_order_id || 'pendiente'}</p>}
          <details><summary>Historial del negocio</summary>{o.history?.map((h,i) => <p key={i}>{statuses[h.status] || h.status} · {new Date(h.created_at).toLocaleString('es-CO')}</p>)}</details></>}
      </article>)}
    </section>}
  </div>;
}
