"use client";

import { useEffect, useState } from "react";
import { Check, ChefHat, Clock3, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api/client";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/components/ui/Toast";

type TicketStatus = "NEW" | "PREPARING" | "READY";
interface KitchenTicket {
  id: string;
  saleId: string;
  status: TicketStatus;
  createdAt: string;
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY" | null;
  tableNumber: string | null;
  receiptNumber: string;
  cashierName: string;
  items: Array<{ name: string; quantity: number; sku: string; selectedOptions: Array<{ id: string; name: string; priceDelta: number }> }> | string;
}

const NEXT_STATUS = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" } as const;
const STATUS_LABEL = { NEW: "New", PREPARING: "Preparing", READY: "Ready" } as const;

export function KitchenBoard() {
  const toast = useToast();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function refresh() {
    try {
      setTickets(await api.get<KitchenTicket[]>("/kitchen/tickets"));
    } catch {
      toast.error("Could not load kitchen tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  async function advance(ticket: KitchenTicket) {
    setUpdatingId(ticket.id);
    try {
      await api.patch("/kitchen/tickets", { ticketId: ticket.id, status: NEXT_STATUS[ticket.status] });
      await refresh();
    } catch {
      toast.error("Ticket status was not updated");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Kitchen"
        description="Confirmed restaurant orders, updated automatically."
        actions={<Button variant="outline" leftIcon={<RefreshCw className="size-4" />} onClick={() => void refresh()}>Refresh</Button>}
      />
      {loading && tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-fg-secondary">Loading kitchen tickets…</p>
      ) : tickets.length === 0 ? (
        <EmptyState icon={<ChefHat className="size-6" />} title="Kitchen is clear" message="New confirmed orders will appear here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tickets.map((ticket) => {
            const items = typeof ticket.items === "string" ? JSON.parse(ticket.items) as KitchenTicket["items"] : ticket.items;
            return (
              <article key={ticket.id} className="overflow-hidden rounded-lg border border-line bg-card">
                <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold text-fg">
                      {ticket.orderType === "DINE_IN" ? `Table ${ticket.tableNumber ?? "?"}` : ticket.orderType === "DELIVERY" ? "Delivery" : "Takeaway"}
                    </h2>
                    <p className="mt-0.5 text-xs text-fg-muted">{ticket.receiptNumber} · {ticket.cashierName}</p>
                  </div>
                  <Badge variant={ticket.status === "NEW" ? "warning" : ticket.status === "READY" ? "success" : "neutral"}>{STATUS_LABEL[ticket.status]}</Badge>
                </div>
                <ul className="divide-y divide-[var(--border-base)] px-4">
                  {Array.isArray(items) && items.map((item, index) => (
                    <li key={`${item.sku}-${index}`} className="flex justify-between gap-3 py-2.5 text-sm">
                      <span className="font-medium text-fg">
                        {item.name}
                        {item.selectedOptions.length > 0 && <span className="mt-0.5 block text-xs font-normal text-fg-secondary">{item.selectedOptions.map((option) => option.name).join(", ")}</span>}
                      </span>
                      <span className="shrink-0 tabular text-fg-secondary">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-2">
                  <span className="flex items-center gap-1.5 text-xs text-fg-muted"><Clock3 className="size-3.5" />{formatDate(ticket.createdAt, "time")}</span>
                  <Button size="sm" loading={updatingId === ticket.id} leftIcon={ticket.status === "READY" ? <Check className="size-4" /> : <ChefHat className="size-4" />} onClick={() => void advance(ticket)}>
                    {ticket.status === "NEW" ? "Start preparing" : ticket.status === "PREPARING" ? "Mark ready" : "Mark served"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}