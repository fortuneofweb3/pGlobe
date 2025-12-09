'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;

  useEffect(() => {
    // Redirect to nodes page - node details are now shown in a modal
    router.replace('/nodes');
  }, [nodeId, router]);

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-black text-foreground">
      <div className="text-center">
        <p className="text-foreground/60">Redirecting to nodes page...</p>
      </div>
    </div>
  );
}
