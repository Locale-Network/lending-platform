'use client';

import { useEffect } from 'react';

export default function SandboxPage() {
  useEffect(() => {
    const accessToken = 'access-sandbox-00ad6834-b999-4941-aba2-8555bafb21fe';
    const loanApplicationId = 'cm4s4pqfa0000js03444lukdh';

    fetch(`/api/loan/${loanApplicationId}/debt-service`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
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
