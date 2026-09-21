"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, ArrowRightLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, ApiClientError } from "@/lib/api/client";
import { useToast } from "@/components/ui/Toast";

interface RegisterOption {
  id: string;
  name: string;
  code: string;
}

interface ShiftRecord {
  id: string;
  shiftNumber: string;
  status: "OPEN" | "CLOSED" | "RECONCILED";
  register: { name: string; code: string };
  openingFloat: number | string | null;
  expectedCash: number | string | null;
  closedAt?: string | null;
}

interface ShiftPortalProps {
  initialOpenShift?: ShiftRecord | null;
}

export function ShiftPortal({ initialOpenShift }: ShiftPortalProps) {
  const { success, error } = useToast();
  const [registers, setRegisters] = useState<RegisterOption[]>([]);
  const [openShift, setOpenShift] = useState<ShiftRecord | null>(initialOpenShift ?? null);
  const [registerId, setRegisterId] = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [closingCount, setClosingCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRegisters = useCallback(async () => {
    try {
      const payload = await api.get<{ registers: RegisterOption[]; currentShift: ShiftRecord | null }>("/shifts");
      const nextRegisters = payload.registers ?? [];
      setRegisters(nextRegisters);
      setOpenShift(payload.currentShift ?? initialOpenShift ?? null);

      if (payload.currentShift) {
        const matchingRegister = nextRegisters.find((register) => register.code === payload.currentShift?.register.code);
        setRegisterId(matchingRegister?.id ?? "");
      } else if (nextRegisters.length > 0 && !registerId) {
        setRegisterId(nextRegisters[0].id);
      }
    } catch (loadError) {
      console.error("Could not load shift data", loadError);
    }
  }, [initialOpenShift, registerId]);

  useEffect(() => {
    void loadRegisters();
  }, [loadRegisters]);

  async function handleOpenShift(event: React.FormEvent) {
    event.preventDefault();
    if (!registerId) {
      error("Choose a register before opening the shift");
      return;
    }

    setBusy(true);
    try {
      const next = await api.post<ShiftRecord>("/shifts", {
        registerId,
        openingFloat: Number(openingFloat || 0),
        notes: notes.trim() || undefined,
      });
      setOpenShift(next);
      setClosingCount(String(next.expectedCash ?? next.openingFloat ?? 0));
      setNotes("");
      success("Shift opened", `Cashier started ${next.shiftNumber}.`);
    } catch (submitError) {
      error(
        submitError instanceof ApiClientError ? submitError.message : "Could not open shift",
        "Check the register and opening float and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCloseShift(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const next = await api.post<ShiftRecord>("/shifts/close", {
        closingCount: Number(closingCount || 0),
        notes: notes.trim() || undefined,
      });
      setOpenShift(null);
      setNotes("");
      setClosingCount("0");
      success("Shift closed", `Closed ${next.shiftNumber} successfully.`);
    } catch (submitError) {
      error(
        submitError instanceof ApiClientError ? submitError.message : "Could not close shift",
        "Review the closing cash count and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-brand-600" /> {openShift ? "Current shift" : "Open shift"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openShift ? (
            <div className="space-y-3 text-sm text-fg-secondary">
              <p>
                <span className="font-medium text-fg">Shift:</span> {openShift.shiftNumber}
              </p>
              <p>
                <span className="font-medium text-fg">Register:</span> {openShift.register.name} ({openShift.register.code})
              </p>
              <p>
                <span className="font-medium text-fg">Opening float:</span> GHS {Number(openShift.openingFloat ?? 0).toFixed(2)}
              </p>
              <p>
                <span className="font-medium text-fg">Expected cash:</span> GHS {Number(openShift.expectedCash ?? openShift.openingFloat ?? 0).toFixed(2)}
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleOpenShift}>
              <Select
                label="Register"
                value={registerId}
                onChange={(event) => setRegisterId(event.target.value)}
                options={registers.map((register) => ({ value: register.id, label: `${register.name} (${register.code})` }))}
                placeholder="Choose a till"
              />

              <Input
                label="Opening float"
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
              />

              <Textarea
                label="Notes (optional)"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opening remarks or cash details"
              />

              <Button type="submit" loading={busy} leftIcon={<Save className="size-4" />} className="w-full sm:w-auto">
                Open shift
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-brand-600" /> Close shift
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!openShift ? (
            <p className="text-sm text-fg-muted">There is no active shift to close. Open one first to begin the day.</p>
          ) : (
            <form className="space-y-4" onSubmit={handleCloseShift}>
              <Input
                label="Closing cash count"
                type="number"
                min="0"
                step="0.01"
                value={closingCount}
                onChange={(event) => setClosingCount(event.target.value)}
              />

              <Textarea
                label="Closure notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Cash variance notes, discrepancies, or handover summary"
              />

              <Button type="submit" variant="primary" loading={busy} leftIcon={<Save className="size-4" />} className="w-full sm:w-auto">
                Close shift
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
