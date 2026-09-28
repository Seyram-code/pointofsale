"use client";

import { useEffect, useState } from "react";
import { LifeBuoy, MessageSquare, Send } from "lucide-react";
import { api, ApiClientError } from "@/lib/api/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  store: { id: string; name: string; branchCode: string };
  createdBy: { id: string; fullName: string; email: string; role: string };
  messages: { id: string; body: string; createdAt: string; author: { id: string; fullName: string; role: string } }[];
};

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  WAITING_FOR_USER: "Waiting for user",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};
const statusVariants: Record<TicketStatus, "success" | "warning" | "danger" | "neutral"> = {
  OPEN: "warning",
  IN_PROGRESS: "warning",
  WAITING_FOR_USER: "neutral",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export function SupportTicketsView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [typingUsers, setTypingUsers] = useState<{ id: string; fullName: string }[]>([]);
  const toast = useToast();
  const selected = selectedId ? tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] : null;

  useEffect(() => {
    if (!isSuperAdmin && selected?.status === "CLOSED") {
      setSelectedId(null);
      setReply("");
    }
  }, [isSuperAdmin, selected]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function refreshTickets(initial = false) {
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const result = await api.get<Ticket[]>("/support/tickets");
        if (cancelled) return;
        setTickets(result);
        setSelectedId((current) => {
          if (current && result.some((ticket) => ticket.id === current)) return current;
          if (!current && !initial) return null;
          return result[0]?.id ?? null;
        });
      } catch (loadError) {
        if (initial && !cancelled) setError(loadError instanceof ApiClientError ? loadError.message : "Unable to load support tickets.");
      } finally {
        inFlight = false;
        if (initial && !cancelled) setLoading(false);
      }
    }

    const refreshOnReturn = () => void refreshTickets();
    const interval = window.setInterval(refreshOnReturn, 5_000);
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    void refreshTickets(true);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTypingUsers([]);
      return;
    }
    let cancelled = false;
    async function refreshTyping() {
      if (document.visibilityState !== "visible") return;
      try {
        const users = await api.get<{ id: string; fullName: string }[]>(`/support/tickets/${selectedId}/typing`);
        if (!cancelled) setTypingUsers(users);
      } catch {
        if (!cancelled) setTypingUsers([]);
      }
    }
    void refreshTyping();
    const interval = window.setInterval(() => void refreshTyping(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !reply.trim()) return;
    const sendTyping = () => void api.post(`/support/tickets/${selectedId}/typing`).catch(() => undefined);
    const timeout = window.setTimeout(sendTyping, 250);
    const interval = window.setInterval(sendTyping, 2_500);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [selectedId, reply]);

  async function createTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      const input = Object.fromEntries(new FormData(event.currentTarget).entries());
      const ticket = await api.post<Ticket>("/support/tickets", input);
      setTickets((current) => [ticket, ...current]);
      setSelectedId(ticket.id);
      form.reset();
      toast.success("Ticket submitted", "Super admins have been notified.");
    } catch (createError) {
      setError(createError instanceof ApiClientError ? createError.message : "Unable to submit the ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const message = await api.post<Ticket["messages"][number]>(`/support/tickets/${selected.id}/messages`, { body: reply });
      setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, messages: [...ticket.messages, message], updatedAt: new Date().toISOString() } : ticket));
      setReply("");
    } catch (replyError) {
      setError(replyError instanceof ApiClientError ? replyError.message : "Unable to send the reply.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(status: TicketStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patch(`/support/tickets/${selected.id}`, { status });
      setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, status, updatedAt: new Date().toISOString() } : ticket));
      if (status === "CLOSED") {
        setSelectedId(null);
        setReply("");
      }
      toast.success("Ticket updated", `Status changed to ${statusLabels[status]}.`);
    } catch (statusError) {
      setError(statusError instanceof ApiClientError ? statusError.message : "Unable to update ticket status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {!isSuperAdmin && (
        <Card>
          <CardHeader><CardTitle>Raise a support ticket</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createTicket} className="grid gap-4 sm:grid-cols-2">
              <Input label="Subject" name="subject" required placeholder="e.g. Cannot complete a sale" />
              <Select label="Category" name="category" required options={[{ value: "ACCOUNT", label: "Account access" }, { value: "POS", label: "POS and sales" }, { value: "INVENTORY", label: "Inventory" }, { value: "BILLING", label: "Billing and subscription" }, { value: "TECHNICAL", label: "Technical issue" }, { value: "OTHER", label: "Other" }]} />
              <Select label="Priority" name="priority" required options={[{ value: "LOW", label: "Low" }, { value: "NORMAL", label: "Normal" }, { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" }]} />
              <div className="sm:col-span-2"><label className="grid gap-1.5 text-sm font-medium text-fg" htmlFor="support-description">Describe the issue<textarea id="support-description" name="description" required minLength={10} rows={4} className="rounded-lg border border-line-strong bg-card px-3 py-2 text-sm text-fg outline-none focus:border-brand-500" placeholder="Include what happened and what you expected." /></label></div>
              {error && <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
              <div className="sm:col-span-2"><Button type="submit" loading={busy} leftIcon={<Send className="size-4" />}>Submit ticket</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && isSuperAdmin && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger dark:bg-red-950/40">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
        <Card>
          <CardHeader><CardTitle>{isSuperAdmin ? "Support inbox" : "Your tickets"}</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-5 text-sm text-fg-muted">Loading tickets...</div> : tickets.length === 0 ? <div className="p-5 text-sm text-fg-muted">No support tickets yet.</div> : <div className="divide-y divide-line">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className={`block w-full p-4 text-left hover:bg-muted/40 ${selected?.id === ticket.id ? "bg-muted/60" : ""}`}><div className="flex items-start justify-between gap-3"><span className="line-clamp-2 text-sm font-semibold text-fg">{ticket.subject}</span><Badge variant={statusVariants[ticket.status]} size="sm">{statusLabels[ticket.status]}</Badge></div><p className="mt-1 text-xs text-fg-muted">{isSuperAdmin ? ticket.store.name : ticket.category} · {new Date(ticket.updatedAt).toLocaleDateString("en-GB")}</p></button>)}</div>}
          </CardContent>
        </Card>

        <Card>
          {!selected ? <CardContent className="flex min-h-64 flex-col items-center justify-center text-center"><LifeBuoy className="size-8 text-fg-muted" /><p className="mt-3 font-medium text-fg">Select a ticket</p><p className="mt-1 text-sm text-fg-muted">Ticket conversations will appear here.</p></CardContent> : <><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selected.subject}</CardTitle><p className="mt-1 text-sm text-fg-muted">{selected.store.name} · {selected.category} · {selected.priority} priority</p></div>{isSuperAdmin && <Select label="Status" value={selected.status} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} onChange={(event) => void updateStatus(event.target.value as TicketStatus)} disabled={busy} />}</div></CardHeader><CardContent><div className="space-y-4">{selected.messages.map((message) => <div key={message.id} className={`rounded-lg border border-line p-3 ${message.author.role === "SUPER_ADMIN" ? "ml-5 bg-brand-50/50 dark:bg-brand-950/20" : "mr-5 bg-muted/30"}`}><div className="flex justify-between gap-3 text-xs text-fg-muted"><span className="font-semibold text-fg">{message.author.fullName}</span><time>{new Date(message.createdAt).toLocaleString("en-GB")}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-fg-secondary">{message.body}</p></div>)}</div>{typingUsers.length > 0 && <p className="mt-4 text-xs italic text-brand-600">{typingUsers.map((user) => user.fullName).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</p>}<form onSubmit={submitReply} className="mt-5 flex gap-2"><Input aria-label="Reply" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply" required /><Button type="submit" loading={busy} size="icon" aria-label="Send reply"><MessageSquare className="size-4" /></Button></form></CardContent></>}
        </Card>
      </div>
    </div>
  );
}
