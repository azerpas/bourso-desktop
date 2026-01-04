import React, { useEffect, useState } from "react";
import { Lock, User, HelpCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { LazyStore } from "@tauri-apps/plugin-store";
import { CREDENTIALS_FILE } from "@/constants";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DashboardInitProgress } from "@/lib/progress";

type LoginModalProps = {
  defaultClientId: string | undefined;
  setClientId: React.Dispatch<React.SetStateAction<string | undefined>>;
  defaultPassword: string | undefined;
  setPassword: React.Dispatch<React.SetStateAction<string | undefined>>;
  dashboardInitProgress: DashboardInitProgress;
  clientError: string | undefined;
};

export function LoginModal(props: LoginModalProps) {
  const {
    defaultClientId,
    defaultPassword,
    clientError,
    dashboardInitProgress,
  } = props;
  const [savePassword, setSavePassword] = useState(
    defaultPassword ? true : false,
  );
  const [showWarning, setShowWarning] = useState(false);
  const [showSavePasswordConfirm, setShowSavePasswordConfirm] = useState(false);

  const formSchema = z.object({
    clientId: z
      .string()
      .min(7, "Client ID must be either 7 or 8 digits")
      .max(8, "Client ID must be either 7 or 8 digits")
      .regex(/^\d+$/, "Client ID must be a number"),
    password: z
      .string()
      .length(8, "Password must be 8 characters long")
      .regex(/^\d+$/, "Password must be a number"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { handleSubmit } = form;

  const onSubmit = handleSubmit(async (data) => {
    const { clientId, password } = data;

    if (savePassword && !showWarning) {
      setShowWarning(true);
      return;
    }

    const store = new LazyStore(CREDENTIALS_FILE);

    // set creds
    props.setClientId(clientId);
    props.setPassword(password);

    // save creds
    await store.set("clientId", clientId);
    if (savePassword) {
      await store.set("password", password);
    }
  });

  const handleSavePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setShowSavePasswordConfirm(true);
    } else {
      setSavePassword(false);
    }
  };

  useEffect(() => {
    if (defaultClientId) {
      form.setValue("clientId", defaultClientId);
    }
  }, [defaultClientId]);

  useEffect(() => {
    if (clientError) {
      form.setError("password", {
        message: clientError,
      });
    }
  }, [clientError]);

  return (
    <TooltipProvider>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-background rounded-lg p-6 w-full max-w-md">
          {showWarning ? (
            <Dialog open={showWarning} onOpenChange={setShowWarning}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive">
                    Security Warning
                  </DialogTitle>
                  <DialogDescription>
                    Storing your password locally poses security risks. Your
                    password will be saved on your device and could potentially
                    be accessed by malicious software.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowWarning(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={onSubmit}>
                    I Understand, Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}

          <Dialog
            open={showSavePasswordConfirm}
            onOpenChange={setShowSavePasswordConfirm}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Password?</DialogTitle>
                <DialogDescription>
                  Are you sure you want to save your password? This will store
                  your credentials locally on your device. <br />
                  Please be aware that anyone with access to your device might
                  be able to see these credentials.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSavePasswordConfirm(false);
                    setSavePassword(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowSavePasswordConfirm(false);
                    setSavePassword(true);
                  }}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <h2 className="text-xl font-bold">Login</h2>

              <FormField
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FormLabel className="text-sm font-medium text-foreground">
                          Client ID
                        </FormLabel>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Your Boursorama client identifier (8 digits)
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <FormControl>
                          <Input
                            type="text"
                            required
                            {...field}
                            className="pl-9"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-foreground">
                          Password
                        </label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Your Boursorama account password
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <FormControl>
                          <Input
                            type="password"
                            required
                            {...field}
                            className="pl-9"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={savePassword}
                  onChange={handleSavePasswordChange}
                  className="rounded text-primary focus:ring-primary"
                />
                <span className="text-sm text-foreground">Save password</span>
              </label>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  dashboardInitProgress === DashboardInitProgress.LOGGIN_IN
                }
              >
                Login
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </TooltipProvider>
  );
}
