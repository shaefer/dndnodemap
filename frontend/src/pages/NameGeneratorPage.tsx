import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ALL_THEMES, describePattern, listWordLists, rerollSlot } from "../nameforge";
import { generateBatch, RANDOM_PATTERN, randomSeed, type NameGeneratorResult } from "./nameGeneratorBatch";

const inputStyle: React.CSSProperties = { fontSize: 12, padding: "4px 6px" };
const buttonStyle: React.CSSProperties = { fontSize: 12, padding: "4px 10px", cursor: "pointer" };

export function NameGeneratorPage() {
  const themeById = useMemo(() => new Map(ALL_THEMES.map((t) => [t.id, t])), []);
  const [themeId, setThemeId] = useState(ALL_THEMES[0].id);
  const [patternId, setPatternId] = useState(RANDOM_PATTERN);
  const [baseSeed, setBaseSeed] = useState(randomSeed());
  const [count, setCount] = useState(10);
  const [results, setResults] = useState<NameGeneratorResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const theme = themeById.get(themeId)!;

  function handleThemeChange(nextId: string) {
    setThemeId(nextId);
    setPatternId(RANDOM_PATTERN); // pattern ids are theme-specific; don't carry one across themes
  }

  function handleGenerate() {
    try {
      setError(null);
      setResults(generateBatch(theme, patternId, baseSeed, Math.max(1, Math.min(200, count))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate names.");
    }
  }

  function handleRerollSlot(resultIndex: number, slotIndex: number) {
    setResults((prev) =>
      prev.map((r, i) => {
        if (i !== resultIndex) return r;
        const rerolled = rerollSlot(themeById.get(r.themeId)!, r, slotIndex);
        return { ...r, parts: rerolled.parts, text: rerolled.text, edited: true };
      })
    );
  }

  function handleCopyJson() {
    navigator.clipboard
      .writeText(JSON.stringify(results, null, 2))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("Couldn't copy to clipboard."));
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={{ fontSize: 13 }}>
          ← Back to map
        </Link>
      </div>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Name Generator</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
        Batch-generate names from a nameforge theme, optionally forcing a specific pattern, with a seed recorded per
        result so any single name is exactly reproducible later.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
        <label style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 4, color: "#888", textTransform: "uppercase", fontSize: 11 }}>Theme</div>
          <select value={themeId} onChange={(e) => handleThemeChange(e.target.value)} style={inputStyle}>
            {ALL_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 4, color: "#888", textTransform: "uppercase", fontSize: 11 }}>Pattern</div>
          <select value={patternId} onChange={(e) => setPatternId(e.target.value)} style={inputStyle}>
            <option value={RANDOM_PATTERN}>Random (any pattern)</option>
            {theme.patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 4, color: "#888", textTransform: "uppercase", fontSize: 11 }}>Base seed</div>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              value={baseSeed}
              onChange={(e) => setBaseSeed(Number(e.target.value) || 0)}
              style={{ ...inputStyle, width: 110 }}
            />
            <button type="button" onClick={() => setBaseSeed(randomSeed())} style={buttonStyle} title="Randomize seed">
              🎲
            </button>
          </div>
        </label>

        <label style={{ fontSize: 12 }}>
          <div style={{ marginBottom: 4, color: "#888", textTransform: "uppercase", fontSize: 11 }}>Count</div>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            style={{ ...inputStyle, width: 70 }}
          />
        </label>

        <button type="button" onClick={handleGenerate} style={{ ...buttonStyle, fontWeight: 600 }}>
          Generate batch
        </button>
      </div>

      {error && <div style={{ color: "#D85A30", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <details style={{ marginBottom: 20, fontSize: 12 }}>
        <summary style={{ cursor: "pointer", color: "#888", textTransform: "uppercase", fontSize: 11 }}>
          Internals — patterns in "{themeId}"
        </summary>
        <ul style={{ marginTop: 8, paddingLeft: 18 }}>
          {theme.patterns.map((p) => (
            <li key={p.id} style={{ marginBottom: 4 }}>
              <code>{p.id}</code>: {describePattern(p)}
            </li>
          ))}
        </ul>
      </details>

      <details open style={{ marginBottom: 20, fontSize: 12 }}>
        <summary style={{ cursor: "pointer", color: "#888", textTransform: "uppercase", fontSize: 11 }}>
          Word lists — "{themeId}"
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          {(() => {
            const lists = listWordLists(theme);
            const topLevel = lists.filter((l) => l.parent === undefined);
            return topLevel.map((list) => {
              const categories = lists.filter((l) => l.parent === list.name);
              return (
                <div key={list.name}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    {list.name} <span style={{ fontWeight: 400, color: "#888" }}>({list.words.length} words)</span>
                  </div>
                  <div style={{ color: "#444", lineHeight: 1.6 }}>{list.words.join(", ")}</div>
                  {categories.length > 0 && (
                    <div style={{ marginTop: 8, marginLeft: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                      {categories.map((cat) => (
                        <div key={cat.name}>
                          <div style={{ fontWeight: 500, marginBottom: 2 }}>
                            {cat.name} <span style={{ fontWeight: 400, color: "#888" }}>({cat.words.length} words)</span>
                          </div>
                          <div style={{ color: "#666", lineHeight: 1.6 }}>{cat.words.join(", ")}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </details>

      {results.length > 0 && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "4px 6px" }}>#</th>
                <th style={{ padding: "4px 6px" }}>Seed</th>
                <th style={{ padding: "4px 6px" }}>Pattern</th>
                <th style={{ padding: "4px 6px" }}>Parts</th>
                <th style={{ padding: "4px 6px" }}>Name</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "4px 6px", color: "#888" }}>{r.index}</td>
                  <td style={{ padding: "4px 6px", color: "#888" }}>{r.seed}</td>
                  <td style={{ padding: "4px 6px", color: "#888" }}>{r.patternId}</td>
                  <td style={{ padding: "4px 6px" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.parts.map((part, slotIndex) => (
                        <span
                          key={slotIndex}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            padding: "1px 4px",
                          }}
                        >
                          {part || <em style={{ color: "#bbb" }}>(empty)</em>}
                          <button
                            type="button"
                            onClick={() => handleRerollSlot(i, slotIndex)}
                            title="Reroll this piece"
                            style={{ fontSize: 10, cursor: "pointer", border: "none", background: "none", padding: 0 }}
                          >
                            🎲
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: "4px 6px", fontWeight: 600 }}>
                    {r.text}
                    {r.edited && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#D85A30", fontWeight: 400 }}>edited</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>JSON</div>
            <button type="button" onClick={handleCopyJson} style={buttonStyle}>
              {copied ? "Copied!" : "Copy JSON"}
            </button>
          </div>
          <pre
            style={{
              background: "#f7f7f5",
              border: "1px solid #eee",
              borderRadius: 4,
              padding: 12,
              fontSize: 11,
              overflowX: "auto",
              maxHeight: 400,
            }}
          >
            {JSON.stringify(results, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
