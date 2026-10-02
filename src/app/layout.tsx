import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterPWA } from '@/components/register-pwa';
export const metadata: Metadata = { title: 'VehicleOps — Disposition & Fahrzeugübergabe', description: 'Fahrzeuge, Transporte und Übergabeprotokolle für dein Team.', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'VehicleOps' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#142c49' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="de"><body>{children}<RegisterPWA /></body></html>; }
