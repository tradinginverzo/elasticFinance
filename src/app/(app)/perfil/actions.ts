"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";

export type ProfileFormState = { error: string | null };

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Escribe tu nombre.").max(50),
  lastName: z.string().trim().max(50),
});

export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const profile = await requireProfile();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.profile.update({
    where: { id: profile.id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName || null,
    },
  });

  redirect("/");
}
