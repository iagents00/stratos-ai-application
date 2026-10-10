// Auth invokes subscribers while holding its session lock. Schedule SDK work
// on a later task: returning a promise here would deadlock getSession/refresh.
export function subscribeAuthEvents(auth, handleEvent, onError) {
  const pending = new Set();
  let disposed = false;
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    const timer = setTimeout(() => {
      pending.delete(timer);
      if (!disposed) Promise.resolve().then(() => handleEvent(event, session)).catch(onError);
    }, 0);
    pending.add(timer);
  });
  return {
    unsubscribe() {
      disposed = true;
      pending.forEach(clearTimeout);
      pending.clear();
      subscription.unsubscribe();
    },
  };
}
