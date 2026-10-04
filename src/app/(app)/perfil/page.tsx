import { requireProfile } from "@/lib/auth";

import { ProfileForm } from "./profile-form";

export const metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">{profile.email}</p>
      </div>
      <ProfileForm firstName={profile.firstName} lastName={profile.lastName} />
    </div>
  );
}
