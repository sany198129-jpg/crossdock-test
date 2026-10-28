 import './globals.css';
 import type { Metadata } from 'next';

 export const metadata: Metadata = {
   title: 'Кросс-док — тестовый стенд',
   description: 'Тестовая страница формирования этикеток кросс-док.',
 };

 export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
      </body>
    </html>
  )
}