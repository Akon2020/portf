// Run from the release folder: renders a one page PDF with the shipped
// node_modules, to catch packages missing from the deployment.
const { renderToBuffer, Document, Page, Text } = await import("@react-pdf/renderer");
const { createElement: h } = await import("react");

const buffer = await renderToBuffer(h(Document, null, h(Page, null, h(Text, null, "Contrôle de la release"))));
if (buffer.subarray(0, 5).toString() !== "%PDF-") {
  console.error("La génération PDF ne fonctionne pas dans la release.");
  process.exit(1);
}
console.log(`Génération PDF OK (${buffer.length} octets).`);
