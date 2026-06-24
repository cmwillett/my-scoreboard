export function formatLastUpdated() {
  return new Date().toLocaleString([], {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatUpcomingGameTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const now = new Date();
  const todayShort = now.toLocaleDateString([], { weekday: 'short' });
  const todayLong = now.toLocaleDateString([], { weekday: 'long' });
  const todayMonth = now.toLocaleDateString([], { month: 'short' });
  const todayDay = String(now.getDate());
  const todayNumericMonth = String(now.getMonth() + 1);
  const todayNumericDay = String(now.getDate());
  const normalized = text.replace(/\s+/g, ' ').trim();

  // IMPORTANT: check no-year strings before Date parsing.
  // JS parses "Wed, Jun 24 6:00 PM" as Jun 24, 2001, which can produce the wrong weekday.
  const dayMonthRegex = new RegExp(`^${escapeRegExp(todayShort)},?\\s+${escapeRegExp(todayMonth)}\\s+${escapeRegExp(todayDay)}\\s+`, 'i');
  if (dayMonthRegex.test(normalized)) {
    return normalized.replace(dayMonthRegex, 'Today ');
  }

  const monthDayRegex = new RegExp(`^${escapeRegExp(todayMonth)}\\s+${escapeRegExp(todayDay)}\\s+`, 'i');
  if (monthDayRegex.test(normalized)) {
    return normalized.replace(monthDayRegex, 'Today ');
  }

  const numericDateRegex = new RegExp(`^${escapeRegExp(todayNumericMonth)}[/-]${escapeRegExp(todayNumericDay)}(?:[/-]\\d{2,4})?\\s*(?:-|at)?\\s*`, 'i');
  if (numericDateRegex.test(normalized)) {
    return normalized.replace(numericDateRegex, 'Today ');
  }

  // Handles strings like "Wed 6:00 PM" when the scheduled weekday is today.
  const dayOnlyRegex = new RegExp(`^(${escapeRegExp(todayShort)}|${escapeRegExp(todayLong)}),?\\s+`, 'i');
  if (dayOnlyRegex.test(normalized)) {
    return normalized.replace(dayOnlyRegex, 'Today ');
  }

  // Only parse strings that contain an explicit year or ISO-style date.
  // This avoids JS inventing old years for schedule strings that don't include one.
  const hasExplicitYear = /\b\d{4}\b/.test(normalized) || /^\d{4}-\d{1,2}-\d{1,2}/.test(normalized);
  if (hasExplicitYear) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const isToday = parsed.toDateString() === now.toDateString();
      const time = parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (isToday) return `Today ${time}`;
      return parsed.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
    }
  }

  return text;
}
