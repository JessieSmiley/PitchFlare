import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";

/**
 * Branded PDF template shared by every report generator. PitchFlare pink
 * header accent + the user's brand logo in the footer when we have one.
 *
 * We render markdown conservatively: split on blank lines for paragraphs,
 * lines starting with `# ` / `## ` / `### ` become headers, `- ` / `* `
 * lines become bullets. No rich-text math / tables / links — PDF output
 * should stay readable as text if the rendering layer ever fails.
 */
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a2744",
    lineHeight: 1.5,
  },
  headerBar: {
    height: 4,
    backgroundColor: "#D4537E",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    color: "#1a2744",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginBottom: 16,
  },
  h1: {
    fontSize: 16,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
    color: "#1a2744",
  },
  h2: {
    fontSize: 13,
    fontFamily: "Times-Roman",
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 4,
    color: "#1a2744",
  },
  h3: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 2,
    color: "#D4537E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  p: { marginBottom: 6 },
  bullet: { marginBottom: 3, paddingLeft: 12 },
  bulletDot: {
    position: "absolute",
    left: 0,
    color: "#D4537E",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#9ca3af",
  },
  logo: { height: 18, width: 54, objectFit: "contain" },
});

type ReportPdfProps = {
  title: string;
  subtitle?: string;
  markdown: string;
  brandName: string;
  brandLogoUrl: string | null;
};

function ReportPdf({
  title,
  subtitle,
  markdown,
  brandName,
  brandLogoUrl,
}: ReportPdfProps) {
  const blocks = parseMarkdown(markdown);
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerBar} />
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {blocks.map((b, i) => {
          if (b.kind === "h1") return <Text key={i} style={styles.h1}>{b.text}</Text>;
          if (b.kind === "h2") return <Text key={i} style={styles.h2}>{b.text}</Text>;
          if (b.kind === "h3") return <Text key={i} style={styles.h3}>{b.text}</Text>;
          if (b.kind === "bullet") {
            return (
              <View key={i} style={styles.bullet}>
                <Text style={styles.bulletDot}>•</Text>
                <Text>{b.text}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={styles.p}>
              {b.text}
            </Text>
          );
        })}

        <View style={styles.footer} fixed>
          <Text>PitchFlare · {brandName}</Text>
          {brandLogoUrl ? (
            <Image src={brandLogoUrl} style={styles.logo} />
          ) : (
            <Text>{new Date().toLocaleDateString()}</Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "bullet"; text: string };

function parseMarkdown(md: string): Block[] {
  const out: Block[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("### ")) {
      out.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      out.push({ kind: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      out.push({ kind: "h1", text: line.slice(2) });
    } else if (/^\s*[-*]\s+/.test(line)) {
      out.push({ kind: "bullet", text: line.replace(/^\s*[-*]\s+/, "") });
    } else {
      out.push({ kind: "p", text: line });
    }
  }
  return out;
}

/**
 * Render a report to a PDF Buffer. Used by the download route handler.
 * `renderToBuffer` is server-only — never import this module in client
 * components.
 */
export async function renderReportPdf(
  opts: ReportPdfProps,
): Promise<Buffer> {
  return await renderToBuffer(<ReportPdf {...opts} />);
}
