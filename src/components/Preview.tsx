"use client";

// Tailwind Play CDN (v4 browser build) so generated class names render inside the iframe.
const TAILWIND_CDN = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

function buildSrcDoc(html: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${TAILWIND_CDN}"></script>
</head>
<body>${html}</body>
</html>`;
}

export function Preview({ html }: { html: string }) {
  return (
    <iframe
      title="Generated UI preview"
      sandbox="allow-scripts"
      srcDoc={buildSrcDoc(html)}
      className="h-[600px] w-full rounded-lg border border-zinc-200 bg-white"
    />
  );
}
