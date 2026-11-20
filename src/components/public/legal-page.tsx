import { SectionLabel } from "./section-heading";

/**
 * Renders a plain text legal document: a line followed by a paragraph is a
 * heading, blank lines separate blocks.
 */
export function LegalPage({ title, text }: { title: string; text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <section className="container-site pt-16 md:pt-24">
      <SectionLabel label={title} />
      <h1 className="mt-8 text-(length:--text-h2) font-medium">{title}</h1>
      <div className="mt-12 max-w-3xl space-y-8">
        {blocks.map((block, index) => {
          const [first, ...rest] = block.split("\n");
          return rest.length > 0 ? (
            <div key={index}>
              <h2 className="font-sans text-lg font-semibold tracking-normal">{first}</h2>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{rest.join("\n")}</p>
            </div>
          ) : (
            <p key={index} className="text-muted-foreground">
              {first}
            </p>
          );
        })}
      </div>
    </section>
  );
}
