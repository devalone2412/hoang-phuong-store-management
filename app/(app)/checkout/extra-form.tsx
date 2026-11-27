"use client";

import { useState, type FormEvent } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseVnd } from "@/lib/money";

export const MAX_EXTRA_AMOUNT = 1_000_000_000;
export const EXTRA_DEFAULT_NAME = "Khoản khác";

type Props = { onAdd: (name: string, amount: number) => void; onClose: () => void };

/** Adds an amount for something that isn't in the product list (a bag, a one-off item, a service). */
export function ExtraForm({ onAdd, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = parseVnd(amount);
    if (value == null || Number.isNaN(value) || value <= 0) return setError("Nhập số tiền hợp lệ");
    if (value > MAX_EXTRA_AMOUNT) return setError("Số tiền quá lớn");
    onAdd(name.trim() || EXTRA_DEFAULT_NAME, value);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-3" aria-label="Thêm khoản khác">
      <div className="grid gap-1.5">
        <Label htmlFor="extra-amount">Số tiền *</Label>
        <MoneyInput
          id="extra-amount"
          autoFocus
          placeholder="15.000"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError("");
          }}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="extra-name">Tên (không bắt buộc)</Label>
        <Input id="extra-name" maxLength={80} placeholder={EXTRA_DEFAULT_NAME} value={name} onChange={(e) => setName(e.target.value)} className="text-base" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" className="h-11">
          Thêm vào đơn
        </Button>
      </div>
    </form>
  );
}
