export function formatLastUpdated() {
  return new Date().toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}