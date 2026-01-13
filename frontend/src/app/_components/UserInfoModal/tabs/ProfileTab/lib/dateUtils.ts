export function formatDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function isSameDay(date1: Date, date2?: Date): boolean {
  if (!date2) return false;
  return date1.toDateString() === date2.toDateString();
}

export function getDateRange(daysAgo: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - daysAgo);
  return { startDate, endDate };
}
