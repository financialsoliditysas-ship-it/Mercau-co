type PollOptions<T> = {
  request: (signal: AbortSignal) => Promise<T>;
  onData: (data: T) => void;
  onError: () => void;
  intervalMs?: number;
  timeoutMs?: number;
};

export function startCustomerOrderPolling<T>({ request, onData, onError, intervalMs = 15000, timeoutMs = 12000 }: PollOptions<T>) {
  let active = true;
  let loading = false;
  let cancel: (() => void) | undefined;
  async function refresh() {
    if (!active || loading || document.visibilityState !== 'visible') return;
    loading = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Bound the entire read, including session recovery before fetch begins.
      const deadline = new Promise<never>((_, reject) => {
        cancel = () => { controller.abort(); reject(new Error('Order read cancelled')); };
        timeout = setTimeout(() => { controller.abort(); reject(new Error('Order read timed out')); }, timeoutMs);
      });
      const result = await Promise.race([Promise.resolve().then(() => request(controller.signal)), deadline]);
      if (active) onData(result);
    } catch {
      if (active) onError();
    } finally {
      clearTimeout(timeout);
      cancel = undefined;
      loading = false;
    }
  }
  const update = () => { void refresh(); };
  const push = (event: MessageEvent) => { if (event.data?.type === 'MERCAU_CUSTOMER_ORDER_CHANGE') update(); };
  const timer = setInterval(update, intervalMs);
  window.addEventListener('mercau:order-updated', update);
  window.addEventListener('focus', update);
  window.addEventListener('online', update);
  document.addEventListener('visibilitychange', update);
  navigator.serviceWorker?.addEventListener('message', push);
  void refresh();
  return {
    refresh: update,
    stop() {
      active = false;
      cancel?.();
      clearInterval(timer);
      window.removeEventListener('mercau:order-updated', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      document.removeEventListener('visibilitychange', update);
      navigator.serviceWorker?.removeEventListener('message', push);
    }
  };
}
