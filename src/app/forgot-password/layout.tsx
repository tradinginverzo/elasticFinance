// La página es un Client Component y no puede exportar metadata; la definimos aquí.
export const metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordLayout({ children }: LayoutProps<"/forgot-password">) {
  return children;
}
