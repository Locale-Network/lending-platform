'use client';

import { useEffect } from 'react';

export default function SandboxPage() {
  useEffect(() => {
    fetch('/api/loan/sandbox')
      .then(res => res.json())
      .then(data => {
        console.log(data);
      })
      .catch(err => {
        console.error(err);
      });
  }, []);

  return <div>Sandbox</div>;
}
