"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeContactFromList } from "@/lib/contacts/list-actions";

export function RemoveMemberButton({
  listId,
  contactId,
}: {
  listId: string;
  contactId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      await removeContactFromList({ mediaListId: listId, contactId });
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
