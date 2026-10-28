import json
import re
import sys
import unicodedata
from pathlib import Path

from docx import Document


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


source = Path(sys.argv[1])
target = Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)

routes = {
    "1": "terminos-y-condiciones",
    "2": "politica-de-tratamiento-de-datos",
    "3": "aviso-de-privacidad",
}

for path in sorted(source.glob("*.docx")):
    document = Document(path)
    title = ""
    sections = []
    current = None
    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        if paragraph.style.name == "Heading 1":
            title = re.sub(r"^\d+\s+", "", text)
        elif paragraph.style.name == "Heading 2":
            current = {"heading": re.sub(r"^\d+\s+", "", text), "paragraphs": []}
            sections.append(current)
        else:
            if current is None:
                current = {"heading": "", "paragraphs": []}
                sections.append(current)
            current["paragraphs"].append(text)
    route = routes[path.name[0]]
    output = {"title": title, "slug": route, "sections": sections}
    (target / f"{route}.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8"
    )
