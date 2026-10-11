"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

export interface MenuOptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export function MenuOptionsDialog({
  productName,
  options,
  open,
  onClose,
  onConfirm,
}: {
  productName: string;
  options: MenuOptionChoice[];
  open: boolean;
  onClose: () => void;
  onConfirm: (selected: MenuOptionChoice[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = options.filter((option) => selectedIds.includes(option.id));

  useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open, productName]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Customize ${productName}`}
      description="Choose any optional add-ons."
      size="sm"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button leftIcon={<Check className="size-4" />} onClick={() => { onConfirm(selected); setSelectedIds([]); }}>Add to order</Button>
        </div>
      }
    >
      <fieldset className="space-y-1">
        <legend className="sr-only">Optional add-ons</legend>
        {options.map((option) => {
          const checked = selectedIds.includes(option.id);
          return (
            <label key={option.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-line py-2 last:border-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setSelectedIds((current) => checked ? current.filter((id) => id !== option.id) : [...current, option.id])}
                className="size-4 accent-brand-600"
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-fg">{option.name}</span>
              {option.priceDelta > 0 && <span className="text-sm text-fg-secondary">+<Money value={option.priceDelta} className="text-sm" /></span>}
            </label>
          );
        })}
      </fieldset>
    </Modal>
  );
}
