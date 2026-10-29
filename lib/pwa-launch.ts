export function pwaLaunchTarget(pathname: string, search: string, hash: string, standalone: boolean): string | null {
  if (!standalone || pathname !== '/') return null;
  const marketingAnchors = ['#como-funciona', '#cobertura', '#para-negocios', '#instalar', '#presentacion-contenido'];
  if (hash && !marketingAnchors.includes(hash)) return null;
  const query = new URLSearchParams(search);
  if (['code', 'access_token', 'refresh_token', 'type', 'error', 'error_code'].some(key => query.has(key))) return null;
  return '/comprar' + search;
}

// Run before the public Home is painted, without rewriting any installed-app identity.
export const pwaLaunchScript = `(function(){
  var standalone = Boolean((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true);
  var target = (${pwaLaunchTarget.toString()})(location.pathname, location.search, location.hash, standalone);
  if (!target) return;
  var root = document.documentElement;
  root.dataset.mercauPwaLaunching = 'true';
  root.style.visibility = 'hidden';
  function restore() { delete root.dataset.mercauPwaLaunching; root.style.removeProperty('visibility'); }
  var fallback = setTimeout(restore, 8000);
  try { location.replace(target); } catch (_) { clearTimeout(fallback); restore(); }
})();`;
