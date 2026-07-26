"use client";

import { useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { BrutalButton } from "@/components/ui/brutal-button";
import { cn } from "@/lib/utils";

type FieldName = "pickup" | "dropoff" | "date" | "time" | "name" | "phone";
type Errors = Partial<Record<FieldName, string>>;

const REQUIRED_LABELS: Record<FieldName, string> = {
  pickup: "Pick-up address",
  dropoff: "Drop-off address",
  date: "Date",
  time: "Time",
  name: "Your name",
  phone: "Phone number",
};

function validateField(name: FieldName, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return `${REQUIRED_LABELS[name]} is required.`;

  if (name === "phone" && trimmed.replace(/\D/g, "").length < 7) {
    return "Enter a phone number we can reach you on, including area code.";
  }
  if (name === "date") {
    const today = new Date().toISOString().slice(0, 10);
    if (trimmed < today) return "Pick today or a date in the future.";
  }
  return undefined;
}

function FormSection({
  step,
  title,
  children,
  className,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby={`booking-${step}`}>
      <div className="mb-3 flex items-center gap-2 lg:mb-4">
        <span className="bg-yellow text-ink flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold lg:h-8 lg:w-8 lg:text-sm">
          {step}
        </span>
        <h3 id={`booking-${step}`} className="font-display text-cream text-sm uppercase lg:text-base">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

export function BookingForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldName;
    if (!(name in REQUIRED_LABELS)) return;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, e.target.value) }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldName;
    if (!errors[name]) return;
    setErrors((prev) => ({ ...prev, [name]: validateField(name, e.target.value) }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Errors = {};

    (Object.keys(REQUIRED_LABELS) as FieldName[]).forEach((name) => {
      const message = validateField(name, String(data.get(name) ?? ""));
      if (message) next[name] = message;
    });

    setErrors(next);
    setTouched(
      Object.fromEntries((Object.keys(REQUIRED_LABELS) as FieldName[]).map((n) => [n, true])),
    );

    const firstInvalid = (Object.keys(REQUIRED_LABELS) as FieldName[]).find((n) => next[n]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }

    setStatus("sending");
    window.setTimeout(() => setStatus("sent"), 900);
  };

  const fieldClass = (name: FieldName) =>
    cn(
      "text-cream placeholder:text-cream-dim/70 min-h-[48px] w-full touch-manipulation border-2 bg-ink px-3 py-2.5 text-base lg:min-h-[48px] lg:px-3 lg:py-2.5",
      "transition-colors duration-200 focus:border-yellow",
      errors[name] && touched[name] ? "border-yellow-deep" : "border-ink-line",
    );

  if (status === "sent") {
    return (
      <div
        className="border-ink bg-yellow text-ink on-yellow border-4 p-6 shadow-[8px_8px_0_var(--ink)] lg:p-7"
        role="status"
      >
        <CheckCircle2 className="h-11 w-11" aria-hidden="true" strokeWidth={2.5} />
        <h2 className="font-display mt-4 text-2xl">Booking request sent</h2>
        <p className="mt-2 text-base leading-relaxed font-medium">
          Dispatch will call you back within 5 minutes to confirm your cab and
          fare. Need it sooner? Call us directly.
        </p>
        <BrutalButton
          onClick={() => {
            setStatus("idle");
            setErrors({});
            setTouched({});
          }}
          color="var(--ink)"
          textColor="var(--yellow)"
          borderColor="var(--ink)"
          shadowColor="var(--ink)"
          className="mt-5 min-h-[48px] w-full lg:w-auto"
        >
          Book another ride
        </BrutalButton>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="booking-heading"
      className="border-yellow bg-ink-soft w-full touch-manipulation border-4 p-4 shadow-[6px_6px_0_var(--yellow)] lg:p-7 lg:shadow-[8px_8px_0_var(--yellow)]"
    >
      <h2 id="booking-heading" className="font-display text-cream text-xl lg:text-3xl">
        Book online
      </h2>
      <p className="text-cream-dim mt-1.5 text-sm leading-snug lg:mt-2 lg:text-sm lg:leading-relaxed">
        Fixed price confirmed before you travel.
        <span className="text-yellow font-bold"> *</span> Required fields.
      </p>

      <div className="mt-5 flex flex-col gap-5 lg:mt-6 lg:gap-6">
        <FormSection step="1" title="Your route">
          <div className="flex flex-col gap-3">
            <Field
              name="pickup"
              label="Pick-up address"
              placeholder="142 Depot Street"
              autoComplete="street-address"
              errors={errors}
              touched={touched}
              onBlur={handleBlur}
              onChange={handleChange}
              className={fieldClass("pickup")}
            />
            <Field
              name="dropoff"
              label="Drop-off address"
              placeholder="Riverside Airport, Terminal 2"
              errors={errors}
              touched={touched}
              onBlur={handleBlur}
              onChange={handleChange}
              className={fieldClass("dropoff")}
            />
          </div>
        </FormSection>

        <FormSection step="2" title="When & who">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
            <Field
              name="date"
              label="Date"
              type="date"
              errors={errors}
              touched={touched}
              onBlur={handleBlur}
              onChange={handleChange}
              className={fieldClass("date")}
            />
            <Field
              name="time"
              label="Time"
              type="time"
              errors={errors}
              touched={touched}
              onBlur={handleBlur}
              onChange={handleChange}
              className={fieldClass("time")}
            />

            <div>
              <label
                htmlFor="passengers"
                className="text-cream mb-1.5 block text-xs font-bold tracking-wide uppercase lg:text-sm"
              >
                Passengers
              </label>
              <select
                id="passengers"
                name="passengers"
                defaultValue="1"
                className={cn(fieldClass("pickup"), "border-ink-line cursor-pointer")}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "passenger" : "passengers"}
                  </option>
                ))}
              </select>
            </div>

            <Field
              name="name"
              label="Your name"
              placeholder="Alex Doyle"
              autoComplete="name"
              errors={errors}
              touched={touched}
              onBlur={handleBlur}
              onChange={handleChange}
              className={fieldClass("name")}
            />
          </div>
        </FormSection>

        <FormSection step="3" title="Contact">
          <Field
            name="phone"
            label="Phone number"
            type="tel"
            inputMode="tel"
            placeholder="(555) 019-2847"
            autoComplete="tel"
            hint="Dispatch calls this number to confirm your cab."
            errors={errors}
            touched={touched}
            onBlur={handleBlur}
            onChange={handleChange}
            className={fieldClass("phone")}
          />
        </FormSection>
      </div>

      <BrutalButton
        type="submit"
        disabled={status === "sending"}
        color="var(--yellow)"
        textColor="var(--ink)"
        borderColor="var(--yellow)"
        shadowColor="var(--yellow-deep)"
        className="mt-5 min-h-[52px] w-full text-base uppercase lg:mt-6 lg:min-h-[48px] lg:text-base"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Sending request…
          </>
        ) : (
          "Request my cab"
        )}
      </BrutalButton>

      <p className="text-cream-dim mt-3 text-center text-xs lg:text-xs">
        No payment taken online. Pay the driver by card or cash.
      </p>
    </form>
  );
}

type FieldProps = {
  name: FieldName;
  label: string;
  hint?: string;
  errors: Errors;
  touched: Partial<Record<FieldName, boolean>>;
  className: string;
  wrapperClass?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

function Field({
  name,
  label,
  hint,
  errors,
  touched,
  className,
  wrapperClass,
  ...props
}: FieldProps) {
  const invalid = Boolean(errors[name] && touched[name]);
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = `${name}-error`;

  return (
    <div className={wrapperClass}>
      <label
        htmlFor={name}
        className="text-cream mb-1.5 block text-xs font-bold tracking-wide uppercase lg:text-sm"
      >
        {label}
        <span className="text-yellow" aria-hidden="true">
          {" "}
          *
        </span>
      </label>

      <input
        id={name}
        name={name}
        required
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby={
          [invalid ? errorId : null, invalid ? null : hintId].filter(Boolean).join(" ") ||
          undefined
        }
        className={className}
        {...props}
      />

      {hint && !invalid && (
        <p id={hintId} className="text-cream-dim mt-1.5 text-xs">
          {hint}
        </p>
      )}

      {invalid && (
        <p
          id={errorId}
          role="alert"
          className="text-yellow mt-1.5 flex items-start gap-1.5 text-xs font-semibold"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {errors[name]}
        </p>
      )}
    </div>
  );
}
