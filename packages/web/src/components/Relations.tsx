import type { PageData, Related } from "../lib/types";
import { PixelAvatar, TypeTag } from "./PixelAvatar";

function Item({ item, quote }: { item: Related; quote?: boolean }) {
  return (
    <a className={`msg${item.wanted ? " msg--wanted" : ""}`} href={item.url}>
      <PixelAvatar type={item.wanted ? "wanted" : item.type} />
      <div style={{ minWidth: 0 }}>
        <div className="msg__head">
          <span className="msg__name">{item.title}</span>
          <span className="msg__time">{item.wanted ? "wanted" : item.type}</span>
        </div>
        {quote && item.context ? <div className="msg__text">“{item.context}”</div> : item.summary ? <div className="msg__text">{item.summary}</div> : null}
      </div>
    </a>
  );
}

/** Typed relations, both directions, grouped by their label (依赖 / 被依赖 / 参见 …). */
export function TypedRelations({ page, empty }: { page: PageData; empty: string }) {
  if (!page.relations.length) return <p className="muted pad">{empty}</p>;
  return (
    <div className="relations">
      {page.relations.map((r) => (
        <section key={`${r.direction}:${r.label}`} className="relations__group">
          <div className="relations__head">
            <span className="relations__arrow" aria-hidden="true">
              {r.direction === "out" ? "→" : "←"}
            </span>
            <strong>{r.label}</strong>
            <span className="mono muted">{r.items.length}</span>
          </div>
          <div className="chat">
            {r.items.map((i) => (
              <Item key={i.id} item={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Plain links into this note, each quoting the sentence that holds the link. */
export function Backlinks({ items, empty }: { items: Related[]; empty: string }) {
  if (!items.length) return <p className="muted pad">{empty}</p>;
  return (
    <div className="chat">
      {items.map((i) => (
        <Item key={i.id} item={i} quote />
      ))}
    </div>
  );
}

export function RelationChips({ page }: { page: PageData }) {
  const out = page.relations.filter((r) => r.direction === "out");
  if (!out.length) return null;
  return (
    <>
      {out.map((r) => (
        <span key={r.label} className="chips">
          <span className="label">{r.label}</span>
          {r.items.map((i) => (
            <a key={i.id} className="chip" href={i.url} data-type={i.type}>
              <TypeTag type={i.wanted ? "wanted" : i.type} label={i.title} />
            </a>
          ))}
        </span>
      ))}
    </>
  );
}
