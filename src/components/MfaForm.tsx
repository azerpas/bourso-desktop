import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Mfa } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

export function InputOTPForm({
  mfa: initialMfa,
  setMfaCompleted,
  setMfaDialogOpen,
}: {
  mfa: Mfa;
  setMfaCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setMfaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [mfa, setMfa] = useState<Mfa>(initialMfa);
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setSubmitted(true);
    try {
      await invoke("submit_mfa", {
        mfa: mfa,
        code: data.pin,
      });
      setMfaCompleted(true);
      setMfaDialogOpen(false);
      toast.success("MFA submitted successfully", {
        description: "You should be redirected to the dashboard shortly.",
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      let message: string;
      if (error.message) {
        message = error.message;
      } else {
        message = error;
      }
      // The first time we submit the MFA, it's likely we'll get another MFA
      // request, so we reset the form and set the new MFA to the latest one
      if (message.includes("mfa required")) {
        form.reset();

        toast.error("Another MFA request", {
          description: "You have to submit another MFA.",
        });

        const mfas: Mfa[] = await invoke("get_mfas");
        setMfa(mfas[mfas.length - 1]);
      }
    }
    setSubmitted(false);
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Multiple factor authentication</DialogTitle>
        <DialogDescription>
          Bourso has sent a one-time password by {mfa.mfa_type}.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-2/3 space-y-6"
        >
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>One-Time Password</FormLabel>
                <FormControl>
                  <InputOTP maxLength={6} {...field}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormDescription>
                  Please enter the one-time password sent by {mfa.mfa_type}.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={submitted}>
            Submit
          </Button>
        </form>
      </Form>
    </DialogContent>
  );
}
