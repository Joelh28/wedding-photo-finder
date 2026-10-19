import type { PhotoAttributes } from "../types";

export function AttributeChips({ attributes }: { attributes: PhotoAttributes }) {
  const groups: [string, string[]][] = [
    ["Outfit", attributes.outfitClothing],
    ["Objects", attributes.objectsAccessories],
    ["Setting", attributes.backgroundLocation],
    ["Colors", attributes.colors],
  ];
  return (
    <div>
      {attributes.summary && (
        <p style={{ margin: "4px 0", fontSize: 13, color: "var(--muted)" }}>
          {attributes.summary}
        </p>
      )}
      {groups
        .filter(([, items]) => items.length > 0)
        .map(([label, items]) => (
          <div key={label} style={{ marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}: </span>
            <span className="chips">
              {items.map((it, i) => (
                <span className="chip" key={`${label}-${i}`}>
                  {it}
                </span>
              ))}
            </span>
          </div>
        ))}
    </div>
  );
}
