import type { SalonStaff } from './api';

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// A match is evidence from the salon's specialty list, not a rating or skill guarantee.
export function rankStylists(staff: SalonStaff[], hairstyle?: string): SalonStaff[] {
  const name = normalize(hairstyle || '');
  const ranked = staff.map(member => ({ ...member, hairstyleMatch: !!name &&
    (member.specialties || '').split(/[,;\n/]/).some(specialty => {
      const term = normalize(specialty);
      return term.length >= 3 && (` ${name} `.includes(` ${term} `) || ` ${term} `.includes(` ${name} `));
    }) }));
  return ranked.sort((a, b) => Number(b.hairstyleMatch) - Number(a.hairstyleMatch));
}
