import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MOON · Autonomous Artist Agency",
  description: "Agencia autónoma multiartista operada por IA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#fafafa", color: "#111" }}>{children}</body>
    </html>
  );
}
