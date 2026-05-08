"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import classNames from "@calcom/ui/classNames";
import { Button } from "@calcom/ui/components/button";
import { Dialog, DialogContent } from "@calcom/ui/components/dialog";
import { showToast } from "@calcom/ui/components/toast";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export interface BookingSuccessActionsProps {
  uid: string;
  title: string;
  formattedDate: string;
  formattedTime: string;
  formattedEndTime: string;
  formattedTimeZone: string;
  rescheduledBy?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BookingSuccessActions({
  uid,
  title,
  formattedDate,
  formattedTime,
  formattedEndTime,
  formattedTimeZone,
  rescheduledBy,
}: BookingSuccessActionsProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const keepMeetingButtonRef = useRef<HTMLButtonElement | null>(null);

  const safeEmail = rescheduledBy && EMAIL_RE.test(rescheduledBy) ? rescheduledBy : null;
  const rescheduleHref = safeEmail
    ? `/reschedule/${uid}?rescheduledBy=${encodeURIComponent(safeEmail)}`
    : `/reschedule/${uid}`;

  const handleConfirmCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      const csrfRes = await fetch("/api/csrf?sameSite=none", { cache: "no-store" });
      if (!csrfRes.ok) {
        throw new Error("csrf");
      }
      const csrfJson = (await csrfRes.json().catch(() => ({}))) as { csrfToken?: unknown };
      const csrfToken = typeof csrfJson.csrfToken === "string" ? csrfJson.csrfToken : "";
      if (!csrfToken) {
        throw new Error("csrf");
      }

      const cancelRes = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          ...(safeEmail ? { cancelledBy: safeEmail } : {}),
          csrfToken,
        }),
      });

      if (cancelRes.status >= 200 && cancelRes.status < 300) {
        showToast(t("booking_cancelled"), "success");
        setIsCancelDialogOpen(false);
        router.refresh();
        return;
      }

      const data = (await cancelRes.json().catch(() => ({}))) as { message?: string };
      const message =
        data.message ||
        `${t("error_with_status_code_occured", { status: cancelRes.status })} ${t("please_try_again")}`;
      showToast(message, "error");
    } catch {
      showToast(t("please_try_again"), "error");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Button color="secondary" href={rescheduleHref} data-testid="booking-success-reschedule">
        {t("reschedule")}
      </Button>
      <Button
        color="minimal"
        data-testid="booking-success-cancel"
        className={classNames(
          "hover:border-semantic-error hover:bg-error hover:text-error",
          "focus-visible:bg-error focus-visible:text-error",
          "transition-colors"
        )}
        onClick={() => setIsCancelDialogOpen(true)}>
        {t("cancel")}
      </Button>

      <Dialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          if (isCancelling) return;
          setIsCancelDialogOpen(open);
        }}>
        <DialogContent
          type="creation"
          title={t("cancel_meeting_confirm_title")}
          description={t("cancel_meeting_confirm_description")}
          data-testid="booking-success-cancel-dialog"
          preventCloseOnOutsideClick={isCancelling}
          onOpenAutoFocus={(e) => {
            // Override Radix's default first-focusable-element behavior so the
            // safe "Keep meeting" escape gets focus, not the destructive confirm.
            // This is what makes Enter close the dialog instead of cancelling.
            e.preventDefault();
            keepMeetingButtonRef.current?.focus();
          }}>
          <dl
            className="border-subtle text-default mb-6 space-y-2 rounded-md border p-4 text-sm"
            data-testid="booking-success-cancel-dialog-summary">
            <div className="flex flex-col">
              <dt className="text-subtle text-xs font-medium uppercase tracking-wide">
                {t("meeting_details")}
              </dt>
              <dd className="text-emphasis font-medium">{title}</dd>
            </div>
            {formattedDate && (
              <div className="flex flex-col">
                <dt className="text-subtle text-xs font-medium uppercase tracking-wide">{t("date")}</dt>
                <dd>{formattedDate}</dd>
              </div>
            )}
            {formattedTime && (
              <div className="flex flex-col">
                <dt className="text-subtle text-xs font-medium uppercase tracking-wide">{t("time")}</dt>
                <dd>
                  {formattedTime}
                  {formattedEndTime && ` – ${formattedEndTime}`}
                  {formattedTimeZone && <span className="text-subtle"> ({formattedTimeZone})</span>}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-row-reverse gap-x-2">
            <Button
              color="destructive"
              loading={isCancelling}
              disabled={isCancelling}
              onClick={handleConfirmCancel}
              data-testid="booking-success-cancel-confirm">
              {t("cancel_meeting")}
            </Button>
            <Button
              ref={keepMeetingButtonRef}
              color="secondary"
              disabled={isCancelling}
              onClick={() => setIsCancelDialogOpen(false)}
              data-testid="booking-success-cancel-keep">
              {t("keep_meeting")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
