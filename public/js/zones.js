// Friendly city search is supplemented by EVERY time zone supported by the browser.
export const cities = [
  ['Abidjan', 'Côte d’Ivoire', 'Africa/Abidjan'], ['Accra', 'Ghana', 'Africa/Accra'],
  ['Addis Ababa', 'Ethiopia', 'Africa/Addis_Ababa'], ['Amsterdam', 'Netherlands', 'Europe/Amsterdam'],
  ['Athens', 'Greece', 'Europe/Athens'], ['Atlanta', 'United States', 'America/New_York'],
  ['Auckland', 'New Zealand', 'Pacific/Auckland'], ['Austin', 'United States', 'America/Chicago'],
  ['Bangalore', 'India', 'Asia/Kolkata'], ['Bangkok', 'Thailand', 'Asia/Bangkok'],
  ['Barcelona', 'Spain', 'Europe/Madrid'], ['Beijing', 'China', 'Asia/Shanghai'],
  ['Beirut', 'Lebanon', 'Asia/Beirut'], ['Berlin', 'Germany', 'Europe/Berlin'],
  ['Bogotá', 'Colombia', 'America/Bogota'], ['Boston', 'United States', 'America/New_York'],
  ['Brisbane', 'Australia', 'Australia/Brisbane'], ['Brussels', 'Belgium', 'Europe/Brussels'],
  ['Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires'], ['Cairo', 'Egypt', 'Africa/Cairo'],
  ['Cape Town', 'South Africa', 'Africa/Johannesburg'], ['Caracas', 'Venezuela', 'America/Caracas'],
  ['Chicago', 'United States', 'America/Chicago'], ['Colombo', 'Sri Lanka', 'Asia/Colombo'],
  ['Copenhagen', 'Denmark', 'Europe/Copenhagen'], ['Dakar', 'Senegal', 'Africa/Dakar'],
  ['Dallas', 'United States', 'America/Chicago'], ['Dhaka', 'Bangladesh', 'Asia/Dhaka'],
  ['Dubai', 'United Arab Emirates', 'Asia/Dubai'], ['Dublin', 'Ireland', 'Europe/Dublin'],
  ['Edinburgh', 'United Kingdom', 'Europe/London'], ['Helsinki', 'Finland', 'Europe/Helsinki'],
  ['Ho Chi Minh City', 'Vietnam', 'Asia/Ho_Chi_Minh'], ['Hong Kong', 'Hong Kong', 'Asia/Hong_Kong'],
  ['Honolulu', 'United States', 'Pacific/Honolulu'], ['Houston', 'United States', 'America/Chicago'],
  ['Islamabad', 'Pakistan', 'Asia/Karachi'], ['Istanbul', 'Türkiye', 'Europe/Istanbul'],
  ['Jakarta', 'Indonesia', 'Asia/Jakarta'], ['Johannesburg', 'South Africa', 'Africa/Johannesburg'],
  ['Karachi', 'Pakistan', 'Asia/Karachi'], ['Kathmandu', 'Nepal', 'Asia/Kathmandu'],
  ['Kigali', 'Rwanda', 'Africa/Kigali'], ['Kuala Lumpur', 'Malaysia', 'Asia/Kuala_Lumpur'],
  ['Lagos', 'Nigeria', 'Africa/Lagos'], ['Abuja', 'Nigeria', 'Africa/Lagos'],
  ['Lima', 'Peru', 'America/Lima'], ['Lisbon', 'Portugal', 'Europe/Lisbon'],
  ['London', 'United Kingdom', 'Europe/London'], ['Los Angeles', 'United States', 'America/Los_Angeles'],
  ['Madrid', 'Spain', 'Europe/Madrid'], ['Manila', 'Philippines', 'Asia/Manila'],
  ['Melbourne', 'Australia', 'Australia/Melbourne'], ['Mexico City', 'Mexico', 'America/Mexico_City'],
  ['Moscow', 'Russia', 'Europe/Moscow'], ['Mumbai', 'India', 'Asia/Kolkata'],
  ['Nairobi', 'Kenya', 'Africa/Nairobi'], ['New Delhi', 'India', 'Asia/Kolkata'],
  ['New York', 'United States', 'America/New_York'], ['Oslo', 'Norway', 'Europe/Oslo'],
  ['Ottawa', 'Canada', 'America/Toronto'], ['Paris', 'France', 'Europe/Paris'],
  ['Perth', 'Australia', 'Australia/Perth'], ['Prague', 'Czechia', 'Europe/Prague'],
  ['Riyadh', 'Saudi Arabia', 'Asia/Riyadh'], ['Rome', 'Italy', 'Europe/Rome'],
  ['San Francisco', 'United States', 'America/Los_Angeles'], ['Santiago', 'Chile', 'America/Santiago'],
  ['São Paulo', 'Brazil', 'America/Sao_Paulo'], ['Seattle', 'United States', 'America/Los_Angeles'],
  ['Seoul', 'South Korea', 'Asia/Seoul'], ['Shanghai', 'China', 'Asia/Shanghai'],
  ['Singapore', 'Singapore', 'Asia/Singapore'], ['Stockholm', 'Sweden', 'Europe/Stockholm'],
  ['Sydney', 'Australia', 'Australia/Sydney'], ['Taipei', 'Taiwan', 'Asia/Taipei'],
  ['Tehran', 'Iran', 'Asia/Tehran'], ['Tokyo', 'Japan', 'Asia/Tokyo'],
  ['Toronto', 'Canada', 'America/Toronto'], ['Vancouver', 'Canada', 'America/Vancouver'],
  ['Vienna', 'Austria', 'Europe/Vienna'], ['Warsaw', 'Poland', 'Europe/Warsaw'],
  ['Washington DC', 'United States', 'America/New_York'], ['Zurich', 'Switzerland', 'Europe/Zurich'],
  ['Adelaide', 'Australia', 'Australia/Adelaide'], ['Darwin', 'Australia', 'Australia/Darwin'],
  ['Chatham Islands', 'New Zealand', 'Pacific/Chatham'], ['UTC', 'Coordinated Universal Time', 'UTC'],
].map(([label, country, zone]) => ({ label, country, zone }));

export const featured = ['Lagos', 'London', 'New York', 'Tokyo', 'Dubai', 'Sydney', 'Mumbai', 'Berlin'];

export function labelFor(zone) {
  return cities.find(c => c.zone === zone)?.label || zone.split('/').at(-1).replaceAll('_', ' ');
}

const canonical = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
const entries = [...cities];
for (const zone of canonical) {
  if (!entries.some(e => e.zone === zone)) entries.push({ label: zone.split('/').at(-1).replaceAll('_', ' '), country: zone.split('/')[0].replaceAll('_', ' '), zone });
}
function normalized(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function searchZones(query) {
  const term = normalized(query.trim());
  if (!term) return featured.map(name => entries.find(e => e.label === name));
  return entries.filter(e => normalized(`${e.label} ${e.country} ${e.zone}`).includes(term))
    .sort((a, b) => Number(normalized(b.label).startsWith(term)) - Number(normalized(a.label).startsWith(term)) || a.label.localeCompare(b.label))
    .slice(0, 30);
}
