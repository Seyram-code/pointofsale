"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RegisterForm } from "@/components/auth/RegisterForm";

export function PlatformRegistrationPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" leftIcon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Register New Business
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register New Business"
        description="Create a business account, owner login, trial period, and subscription plan."
        size="xl"
      >
        <RegisterForm platformMode />
      </Modal>
    </>
  );
}
