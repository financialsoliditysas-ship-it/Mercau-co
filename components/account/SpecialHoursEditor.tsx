"use client";
import { Plus, Trash2 } from "lucide-react";
export type SpecialHours = {
  date: string;
  closed: boolean;
  periods: { start: string; end: string }[];
}[];
export default function SpecialHoursEditor({
  value,
  onChange,
}: {
  value: SpecialHours;
  onChange: (value: SpecialHours) => void;
}) {
  function change(index: number, patch: Partial<SpecialHours[number]>) {
    onChange(value.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  }
  return (
    <section className="ma-divider">
      <h2>Horarios especiales</h2>
      {value.map((day, index) => (
        <div className="ma-band ma-form" key={index}>
          <div className="ma-section-heading">
            <label>
              Fecha
              <input
                aria-label={`Fecha especial ${index + 1}`}
                type="date"
                value={day.date}
                onChange={(e) => change(index, { date: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="ma-button"
              title="Quitar horario especial"
              aria-label={`Quitar horario especial ${index + 1}`}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <label className="ma-check">
            <input
              type="checkbox"
              checked={day.closed}
              onChange={(e) =>
                change(index, {
                  closed: e.target.checked,
                  periods: e.target.checked
                    ? []
                    : [{ start: "09:00", end: "18:00" }],
                })
              }
            />
            Cerrado en esta fecha
          </label>
          {!day.closed &&
            day.periods.map((period, i) => (
              <div className="ma-time-pair" key={i}>
                <input
                  aria-label={`Apertura especial ${index + 1} tramo ${i + 1}`}
                  type="time"
                  value={period.start}
                  onChange={(e) =>
                    change(index, {
                      periods: day.periods.map((p, j) =>
                        j === i ? { ...p, start: e.target.value } : p,
                      ),
                    })
                  }
                />
                <span>a</span>
                <input
                  aria-label={`Cierre especial ${index + 1} tramo ${i + 1}`}
                  type="time"
                  value={period.end}
                  onChange={(e) =>
                    change(index, {
                      periods: day.periods.map((p, j) =>
                        j === i ? { ...p, end: e.target.value } : p,
                      ),
                    })
                  }
                />
              </div>
            ))}
          {!day.closed && day.periods.length < 2 && (
            <button
              type="button"
              className="ma-text-button"
              onClick={() =>
                change(index, {
                  periods: [...day.periods, { start: "19:00", end: "22:00" }],
                })
              }
            >
              Agregar segundo tramo especial
            </button>
          )}
        </div>
      ))}
      {value.length < 10 && (
        <button
          type="button"
          className="ma-button"
          onClick={() =>
            onChange([...value, { date: "", closed: true, periods: [] }])
          }
        >
          <Plus size={18} />
          Agregar fecha especial
        </button>
      )}
    </section>
  );
}
