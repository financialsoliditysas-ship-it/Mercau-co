"use client";
import { useId } from "react";
import { birthDateError, latestAdultBirthDate } from "@/lib/account-age";
export default function BirthDateField({
  value,
  onChange,
  className,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const id = useId(),
    error = value ? birthDateError(value) : "";
  return (
    <label className={className}>
      Fecha de nacimiento
      <input
        aria-label="Fecha de nacimiento"
        name="birthDate"
        type="date"
        required
        autoComplete="bday"
        max={latestAdultBirthDate()}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={id}
        className={inputClassName}
      />
      <small
        id={id}
        role={error ? "alert" : undefined}
        style={error ? { color: "#D82016" } : undefined}
      >
        {error || "Debes tener 18 años cumplidos para crear una cuenta."}
      </small>
    </label>
  );
}
