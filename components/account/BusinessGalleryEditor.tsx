"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ImagePlus } from "lucide-react";
import { useAccount } from "./AccountSession";
import { prepareImage } from "@/lib/prepare-image";
type Photo = {
  id: string;
  kind: "cover" | "gallery";
  url: string;
  hidden: boolean;
};
export default function BusinessGalleryEditor({
  businessId,
  onUpdated,
}: {
  businessId: string;
  onUpdated: () => void;
}) {
  const { request } = useAccount(),
    [photos, setPhotos] = useState<Photo[]>([]),
    [kind, setKind] = useState("gallery"),
    [image, setImage] = useState(""),
    [uploadId, setUploadId] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    request(`/api/mi-negocio/${businessId}/galeria`)
      .then((result) => {
        if (active) setPhotos(result.photos);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, [businessId, request]);
  async function upload() {
    setBusy(true);
    setNotice("");
    try {
      const result = await request(`/api/mi-negocio/${businessId}/galeria`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          file: image.split(",")[1],
          requestId: uploadId,
        }),
      });
      setPhotos(result.photos);
      setImage("");
      setNotice("Foto guardada. La imagen principal no cambió.");
      onUpdated();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function visibility(photo: Photo) {
    setBusy(true);
    try {
      const result = await request(`/api/mi-negocio/${businessId}/galeria`, {
        method: "PATCH",
        body: JSON.stringify({ id: photo.id, hidden: !photo.hidden }),
      });
      setPhotos(result.photos);
      setNotice(
        photo.hidden ? "Foto visible." : "Foto oculta sin borrar el archivo.",
      );
      onUpdated();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ma-divider">
      <h2>Portada y galería</h2>
      <p className="ma-muted">
        JPG, PNG o WebP de hasta 12 MB. Se preparan antes de subir; el archivo
        enviado queda limitado a 2 MB.
      </p>
      <div className="ma-form">
        <label>
          Tipo de foto
          <select
            aria-label="Tipo de foto adicional"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="cover">Foto de portada</option>
            <option value="gallery">
              Galería del establecimiento o servicios
            </option>
          </select>
        </label>
        <label>
          Seleccionar foto adicional
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setImage("");
              setUploadId(crypto.randomUUID());
              if (!file) return;
              setBusy(true);
              try {
                setImage(await prepareImage(file));
              } catch (error) {
                setNotice((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {image && (
          <img
            src={image}
            alt="Vista previa de foto adicional"
            style={{ maxWidth: 260, maxHeight: 180, objectFit: "contain" }}
          />
        )}
        <button
          type="button"
          disabled={!image || busy}
          className="ma-button"
          onClick={upload}
        >
          <ImagePlus size={18} />
          Guardar foto adicional
        </button>
      </div>
      <div className="ma-gallery-grid">
        {photos.map((photo) => (
          <figure key={photo.id}>
            {photo.hidden ? (
              <div className="ma-gallery-placeholder">
                <EyeOff size={24} />
              </div>
            ) : (
              <img
                src={photo.url}
                alt={
                  photo.kind === "cover"
                    ? "Portada del negocio"
                    : "Foto de galería"
                }
              />
            )}
            <figcaption>
              {photo.kind === "cover" ? "Portada" : "Galería"} ·{" "}
              {photo.hidden ? "Oculta" : "Visible"}
            </figcaption>
            <button
              type="button"
              disabled={busy}
              title={photo.hidden ? "Mostrar foto" : "Ocultar foto"}
              className="ma-button"
              onClick={() => visibility(photo)}
            >
              {photo.hidden ? <Eye size={16} /> : <EyeOff size={16} />}{" "}
              {photo.hidden ? "Mostrar" : "Ocultar"}
            </button>
          </figure>
        ))}
      </div>
      {notice && (
        <p className="ma-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
