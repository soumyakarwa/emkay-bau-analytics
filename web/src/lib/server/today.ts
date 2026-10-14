/** Today in India, where the team works: YYYY-MM-DD. */
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
