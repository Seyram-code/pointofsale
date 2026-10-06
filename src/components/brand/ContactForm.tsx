"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { api, ApiClientError } from "@/lib/api/client";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      await api.post("/contact", { name, email, phone, message, website });
      setFeedback({ kind: "success", text: "Thanks for reaching out. Your message has been sent." });
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof ApiClientError ? error.message : "We couldn’t send your message. Please try again or email hello@vidyposgh.com.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Input label="Your name" name="name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required />
      <Input label="Email address" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
      <Input label="Phone (optional)" name="phone" type="tel" autoComplete="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} />
      <Textarea label="How can we help?" name="message" rows={5} maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} required />
      <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
      {feedback && (
        <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-sm ${feedback.kind === "error" ? "text-red-300" : "text-emerald-300"}`}>
          {feedback.text}
        </p>
      )}
      <Button type="submit" loading={submitting} disabled={submitting} leftIcon={submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}>
        Send message
      </Button>
    </form>
  );
}