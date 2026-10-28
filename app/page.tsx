'use client';

import { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    window.location.replace('./castdocs/');
  }, []);

  return (
    <p style={{ fontFamily: 'sans-serif', padding: 24, fontSize: 15 }}>
      Открываем страницу формирования этикеток кросс-док…{' '}
      <a href="./castdocs/" style={{ color: '#1A5276', textDecoration: 'underline' }}>
        Перейти по ссылке
      </a>
    </p>
  );
}
