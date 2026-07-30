"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { removerFolga } from "@/app/actions/cronograma";

export function RemoverFolgaButton({ obraId, folgaId }: { obraId: string; folgaId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(() => {
      removerFolga(obraId, folgaId).then(() => router.refresh());
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending} variant="ghost" size="icon-sm">
      <Trash2 className="size-4" />
    </Button>
  );
}
