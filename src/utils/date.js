export function formatLastUpdated() {
  return new Date().toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export function formatUpcomingGameTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const now = new Date();
  const todayShort = now.toLocaleDateString([], { weekday: 'short' });
  const todayLong = now.toLocaleDateString([], { weekday: 'long' });
  const todayMonth = now.toLocaleDateString([], { month: 'short' });
  const todayDay = String(now.getDate());

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const isToday = parsed.toDateString() === now.toDateString();
    const time = parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today ${time}`;
    return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();

  // Handles strings like "Wed, Jun 24 6:00 PM" or "Wed Jun 24 6:00 PM".
  const dayMonthRegex = new RegExp(`^${todayShort},?\\s+${todayMonth}\\s+${todayDay}\\s+`, 'i');
  if (dayMonthRegex.test(normalized)) {
    return normalized.replace(dayMonthRegex, 'Today ');
  }

  // Handles strings like "Wed 6:00 PM" when the scheduled weekday is today.
  const dayOnlyRegex = new RegExp(`^(${todayShort}|${todayLong}),?\\s+`, 'i');
  if (dayOnlyRegex.test(normalized)) {
    return normalized.replace(dayOnlyRegex, 'Today ');
  }

  return text;
}
