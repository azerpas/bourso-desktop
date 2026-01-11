import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Mfa } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";

const MFA_POLLING_INTERVAL_MS = 5000;

export function MfaPrompt({
  setMfaCompleted,
  setMfaDialogOpen,
}: {
  mfa: Mfa;
  setMfaCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setMfaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check MFA status
  const checkMfaStatus = async () => {
    try {
      const result: boolean = await invoke("check_mfa");
      if (result) {
        // MFA confirmed
        setMfaCompleted(true);
        setMfaDialogOpen(false);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        toast.success("Authentication successful", {
          description: "You have been authenticated successfully.",
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      let message: string;
      if (error.message) {
        message = error.message;
      } else {
        message = error;
      }

      // Check if it's a QR code required error
      if (message.startsWith("qrcode:")) {
        const qrCodeData = message.substring(7); // Remove "qrcode:" prefix
        console.log(`Received QR code data: ${qrCodeData}`);
        setQrCode(qrCodeData);
      } else if (!message.includes("mfa")) {
        // Only show error if it's not just a "not confirmed yet" status
        console.error("Error checking MFA:", message);
      }
    }
  };

  // Generate QR code on canvas
  useEffect(() => {
    if (qrCode && canvasRef.current) {
      const generateQRCode = async () => {
        try {
          // Dynamically import QRCode library
          const QRCode = (await import("qrcode")).default;
          const canvas = canvasRef.current;
          if (canvas) {
            await QRCode.toCanvas(canvas, qrCode, {
              width: 256,
              margin: 2,
              errorCorrectionLevel: "M",
              color: {
                dark: "#000000",
                light: "#FFFFFF",
              },
            });
          }
        } catch (error) {
          console.error("Error generating QR code:", error);
          toast.error("Failed to generate QR code");
        }
      };
      generateQRCode();
    }
  }, [qrCode]);

  // Start polling for MFA confirmation
  useEffect(() => {
    // Check immediately
    checkMfaStatus();

    // Then check every 5 seconds
    checkIntervalRef.current = setInterval(checkMfaStatus, MFA_POLLING_INTERVAL_MS);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Authentication Required</DialogTitle>
        <DialogDescription>
          {qrCode
            ? "Scan the QR code below with your phone to authenticate."
            : "A push notification has been sent to your phone. Please confirm the login."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center justify-center space-y-4 py-6">
        {qrCode ? (
          <div className="flex flex-col items-center space-y-4">
            <canvas
              ref={canvasRef}
              className="border-2 border-gray-300 rounded"
            />
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code with your BoursoBank mobile app
            </p>
          </div>
        ) : (
          <>
            <Smartphone className="w-16 h-16 text-primary animate-pulse" />
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Waiting for confirmation...
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            if (checkIntervalRef.current) {
              clearInterval(checkIntervalRef.current);
            }
            setMfaDialogOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </DialogContent>
  );
}
