#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
host="127.0.0.1"
port="4173"
base_url="http://${host}:${port}"
session="pdflover-production-smoke-$$"
preview_log="$(mktemp "${TMPDIR:-/tmp}/pdflover-preview.XXXXXX.log")"
preview_pid=""

if command -v playwright-cli >/dev/null 2>&1; then
  playwright=(playwright-cli)
elif command -v npx >/dev/null 2>&1; then
  playwright=(npx --yes --package @playwright/cli playwright-cli)
else
  echo "error: playwright-cli or npx is required for the production web smoke test" >&2
  exit 1
fi

cleanup() {
  "${playwright[@]}" -s="$session" close >/dev/null 2>&1 || true

  if [[ -n "$preview_pid" ]] && kill -0 "$preview_pid" >/dev/null 2>&1; then
    kill "$preview_pid" >/dev/null 2>&1 || true
    wait "$preview_pid" >/dev/null 2>&1 || true
  fi

  rm -f "$preview_log"
}

trap cleanup EXIT INT TERM

cd "$repo_root"
bun run --cwd "$repo_root/apps/web" build

bun run --cwd "$repo_root/apps/web" preview -- \
  --host "$host" \
  --port "$port" \
  --strictPort >"$preview_log" 2>&1 &
preview_pid="$!"

for _ in {1..60}; do
  if curl --fail --silent --output /dev/null "$base_url/"; then
    break
  fi

  if ! kill -0 "$preview_pid" >/dev/null 2>&1; then
    echo "error: Vite preview stopped before becoming ready" >&2
    sed -n '1,160p' "$preview_log" >&2
    exit 1
  fi

  sleep 0.25
done

if ! curl --fail --silent --output /dev/null "$base_url/"; then
  echo "error: Vite preview did not become ready at $base_url" >&2
  sed -n '1,160p' "$preview_log" >&2
  exit 1
fi

"${playwright[@]}" -s="$session" open about:blank
playwright_output="$("${playwright[@]}" -s="$session" run-code "async (page) => {
  const baseUrl = '$base_url';
  const browserErrors = [];

  page.on('pageerror', (error) => {
    browserErrors.push('pageerror [' + page.url() + ']: ' + error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push('console.error [' + page.url() + ']: ' + message.text());
    }
  });

  const verifyPageChrome = async () => {
    await page.getByRole('banner').waitFor();
    await page.getByRole('contentinfo').waitFor();

    const footer = page.getByRole('navigation', { name: 'Footer navigation' });
    await footer.getByRole('link', { name: 'All tools' }).waitFor();
    await footer.getByRole('link', { name: 'Library' }).waitFor();
    await footer.getByRole('link', { name: 'History' }).waitFor();
    await footer.getByRole('link', { name: 'Settings' }).waitFor();
  };

  const visit = async (path, heading) => {
    const response = await page.goto(baseUrl + path, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      throw new Error('HTTP request failed for ' + path + ': ' + (response ? response.status() : 'no response'));
    }
    await page.getByRole('heading', { name: heading }).waitFor();
    await verifyPageChrome();
  };

  const workspaceRoutes = [
    ['/merge', 'Merge PDF'],
    ['/split', 'Split PDF'],
    ['/compress', 'Compress PDF'],
    ['/convert', 'Convert PDF'],
    ['/security', 'Protect PDF'],
    ['/watermark', 'Add Watermark'],
    ['/signature', 'Sign PDF'],
    ['/chat', 'Chat with PDF'],
    ['/editor', 'PDF Editor'],
    ['/search', 'Search & Replace'],
    ['/batch', 'Batch Operations'],
    ['/extract-images', 'Extract Images'],
    ['/extract-tables', 'Extract Tables'],
    ['/page-numbers', 'Page Numbers & Headers'],
    ['/crop-resize', 'Crop, Resize & Trim'],
    ['/compare', 'Compare PDFs'],
    ['/toc', 'Table of Contents'],
    ['/form-detection', 'Detect Form Fields'],
    ['/classify', 'Classify Document'],
    ['/key-info', 'Extract Key Information'],
    ['/files', 'Library'],
    ['/history', 'History'],
    ['/settings', 'Settings'],
  ];

  const visitWorkspace = async ([path, title]) => {
    const response = await page.goto(baseUrl + path, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      throw new Error('HTTP request failed for ' + path + ': ' + (response ? response.status() : 'no response'));
    }

    await page.getByText('Loading workspace…').waitFor({ state: 'detached' });
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await breadcrumb.getByText(title, { exact: true }).waitFor();

    const shortcuts = page.getByRole('navigation', { name: 'Workspace shortcuts' });
    await shortcuts.getByRole('link', { name: 'Library' }).waitFor();
    await shortcuts.getByRole('link', { name: 'History' }).waitFor();
    await shortcuts.getByRole('link', { name: 'Settings' }).waitFor();
    await verifyPageChrome();
  };

  await visit('/', 'Every PDF tool, one click away.');
  await page.getByRole('searchbox', { name: 'Search PDF tools' }).waitFor();
  for (const route of workspaceRoutes) {
    await visitWorkspace(route);
  }

  if (browserErrors.length > 0) {
    throw new Error(browserErrors.join('\\n'));
  }

  return { routes: ['/', ...workspaceRoutes.map(([path]) => path)], browserErrors: 0 };
}")"

printf '%s\n' "$playwright_output"
if [[ "$playwright_output" == *"### Error"* ]]; then
  echo "error: Playwright reported a browser verification failure" >&2
  exit 1
fi

echo "Production web smoke test passed: every routed page rendered with header, footer, shared navigation, and no browser errors."
