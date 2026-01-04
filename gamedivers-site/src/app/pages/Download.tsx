import Button from "../components/Button";

type DownloadItem = { label: string; note: string; href: string };

const downloads: DownloadItem[] = [
  { label: "Windows", note: "Installer (.exe)", href: "#" },
  { label: "macOS", note: "DMG (.dmg)", href: "#" },
  { label: "Linux", note: "AppImage / .deb", href: "#" },
];

const card: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 18,
  padding: 16,
};

export default function Download() {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ ...card, padding: 18 }}>
        <h2 style={{ margin: 0 }}>Download</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, marginTop: 8 }}>
          Replace these links with GitHub Releases or your CDN.
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {downloads.map((d) => (
            <div key={d.label} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{d.label}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>{d.note}</div>
              </div>
              <Button as="a" href={d.href} className="primary">
                Download
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
