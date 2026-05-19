/**
 * Value for HTML `datetime-local`: local calendar date and time with no
 * timezone suffix. Uses the device/OS timezone, so it updates when the user
 * travels and the system timezone changes.
 */
export function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
