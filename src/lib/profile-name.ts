type NamedProfile = { firstName: string | null; lastName: string | null; email: string };

// "Dayaris Rojas"; si no tiene nombre, la parte del email antes de la @.
export function fullName(profile: NamedProfile) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.email.split("@")[0];
}

// Para saludos y listas: "Dayaris"; si no tiene nombre, la parte del email antes de la @.
export function shortName(profile: NamedProfile) {
  return profile.firstName?.trim() || profile.email.split("@")[0];
}

export const profileNameSelect = { firstName: true, lastName: true, email: true } as const;
