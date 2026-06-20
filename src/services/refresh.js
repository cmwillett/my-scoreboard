let refreshTimer = null;

export function startAutoRefresh(callback, intervalMs) {
  stopAutoRefresh();

  refreshTimer = setInterval(() => {
    callback();
  }, intervalMs);
}

export function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}