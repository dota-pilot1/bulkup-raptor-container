"use client";

import { useState } from "react";
import { devAccounts, type DevAccount } from "../model/dev-accounts";

type Props = {
  disabled?: boolean;
  onEnter: (account: DevAccount) => Promise<void>;
};

export function DevAccountButtons({ disabled = false, onEnter }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="signup-role-row" aria-label="개발용 계정">
      {devAccounts.map((account) => {
        const pending = pendingId === account.id;
        return (
          <button
            key={account.id}
            type="button"
            className="signup-role-button"
            disabled={disabled || pendingId !== null}
            onClick={() => {
              setPendingId(account.id);
              void onEnter(account).finally(() => setPendingId(null));
            }}
          >
            {pending ? "입장 중" : account.label}
          </button>
        );
      })}
    </div>
  );
}
