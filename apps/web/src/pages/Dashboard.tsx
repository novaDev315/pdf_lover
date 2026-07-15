/**
 * Dashboard - complete tool catalog and document workspace entry point.
 */

import * as React from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  FolderOpen,
  Heart,
  History as HistoryIcon,
  Laptop,
  MoreVertical,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { db } from '@/lib/storage';
import {
  findTools,
  TOOL_CATALOG,
  TOOL_CATEGORIES,
  type ToolCategoryId,
  type ToolDefinition,
} from '@/lib/tool-catalog';
import { cn, formatFileSize, truncateFilename } from '@/lib/utils';
import { selectFilteredFiles, useFileStore } from '@/store/file-store';

const CATEGORY_BY_ID = new Map(
  TOOL_CATEGORIES.map((category) => [category.id, category]),
);

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const category = CATEGORY_BY_ID.get(tool.category)!;
  const Icon = tool.icon;

  return (
    <Link
      to={tool.path}
      aria-label={`Open ${tool.name}`}
      className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <article className="h-full rounded-2xl border border-surface-200 bg-white p-5 shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:border-primary-300 group-hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:group-hover:border-primary-700">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              category.surfaceClass,
              category.iconClass,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-surface-950 transition-colors group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
                {tool.name}
              </h3>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-surface-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-600"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 text-sm leading-6 text-surface-600 dark:text-surface-400">
              {tool.description}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

interface RecentFileItemProps {
  file: {
    id: string;
    filename: string;
    fileSize: number;
    updatedAt: Date;
    isFavorite?: boolean;
  };
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

function RecentFileItem({ file, onToggleFavorite, onDelete }: RecentFileItemProps) {
  const timeAgo = React.useMemo(() => {
    const now = new Date();
    const updated = new Date(file.updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return updated.toLocaleDateString();
  }, [file.updatedAt]);

  return (
    <div className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-50 focus-within:bg-surface-50 dark:hover:bg-surface-800 dark:focus-within:bg-surface-800">
      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
        <span className="text-[10px] font-bold tracking-wide">PDF</span>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          to={`/editor?document=${encodeURIComponent(file.id)}`}
          className="block truncate text-sm font-medium text-surface-900 hover:text-primary-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-white dark:hover:text-primary-400"
        >
          {truncateFilename(file.filename, 35)}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
          <span>{formatFileSize(file.fileSize)}</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {timeAgo}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite(file.id)}
        >
          <Star
            className={cn(
              'h-4 w-4',
              file.isFavorite
                ? 'fill-yellow-500 text-yellow-500'
                : 'text-surface-400',
            )}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="File actions">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/editor?document=${encodeURIComponent(file.id)}`}>
                Open in editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleFavorite(file.id)}>
              <Star className="mr-2 h-4 w-4" />
              {file.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(file.id)}
              className="text-red-600 dark:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function Dashboard() {
  const files = useFileStore(useShallow(selectFilteredFiles));
  const { toggleFavorite, removeFile } = useFileStore();
  const [toolQuery, setToolQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState<ToolCategoryId | 'all'>('all');

  const handleToggleFavorite = React.useCallback(async (id: string) => {
    const file = useFileStore.getState().files.find((candidate) => candidate.id === id);
    if (!file) return;
    await db.updateDocument(id, { isFavorite: !file.isFavorite });
    toggleFavorite(id);
  }, [toggleFavorite]);

  const handleDelete = React.useCallback(async (id: string) => {
    await db.deleteDocument(id);
    removeFile(id);
  }, [removeFile]);

  const recentFiles = React.useMemo(() => {
    return [...files]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [files]);

  const favoriteFiles = React.useMemo(() => {
    return files.filter((file) => file.isFavorite).slice(0, 5);
  }, [files]);

  const filteredTools = React.useMemo(
    () => findTools(toolQuery, activeCategory),
    [activeCategory, toolQuery],
  );

  const visibleCategories = React.useMemo(() => {
    return TOOL_CATEGORIES.map((category) => ({
      ...category,
      tools: filteredTools.filter((tool) => tool.category === category.id),
    })).filter((category) => category.tools.length > 0);
  }, [filteredTools]);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="sticky top-0 z-20 border-b border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Heart className="h-8 w-8 text-primary-500" fill="currentColor" aria-hidden="true" />
            <span className="text-xl font-bold text-surface-950 dark:text-white">PDFLover</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Workspace navigation">
            <Button variant="ghost" className="hidden md:inline-flex" asChild>
              <a href="#all-tools">All tools</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/files">
                <FolderOpen className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Library</span>
                <span className="sr-only sm:hidden">Library</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history">
                <HistoryIcon className="h-4 w-4 sm:mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">History</span>
                <span className="sr-only sm:hidden">History</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings" aria-label="Settings">
                <Settings className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="grid gap-8 border-b border-surface-200 pb-10 dark:border-surface-800 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              {TOOL_CATALOG.length} PDF tools available
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-surface-950 dark:text-white sm:text-5xl">
              Every PDF tool, one click away.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-surface-600 dark:text-surface-300 sm:text-lg">
              Choose a task below instead of remembering routes. Browser-safe work stays local; tools that need the backend explain the temporary upload first.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/editor">
                  Open PDF editor
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/files">Open document library</Link>
              </Button>
            </div>
          </div>

          <aside className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900" aria-label="Privacy model">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-surface-950 dark:text-white">Local by default</h2>
                <p className="mt-1 text-sm leading-6 text-surface-600 dark:text-surface-400">
                  Your library lives in this browser. Server jobs are bounded, explicit, and temporary.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-surface-100 pt-4 text-xs font-medium text-surface-500 dark:border-surface-800 dark:text-surface-400">
              <Laptop className="h-4 w-4" aria-hidden="true" />
              No analytics and no permanent server library
            </div>
          </aside>
        </section>

        <section id="all-tools" className="scroll-mt-24 py-10" aria-labelledby="all-tools-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 id="all-tools-heading" className="text-2xl font-bold text-surface-950 dark:text-white">
                All PDF tools
              </h2>
              <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">
                Search by task or browse the complete catalog by category.
              </p>
            </div>

            <div className="relative w-full lg:max-w-md">
              <label htmlFor="tool-search" className="sr-only">Search PDF tools</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" aria-hidden="true" />
              <Input
                id="tool-search"
                type="search"
                value={toolQuery}
                onChange={(event) => setToolQuery(event.target.value)}
                placeholder="Search tools, formats, or tasks…"
                className="h-11 rounded-xl bg-white pl-10 pr-10 dark:bg-surface-900"
              />
              {toolQuery && (
                <button
                  type="button"
                  onClick={() => setToolQuery('')}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-100 hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-surface-800 dark:hover:text-white"
                  aria-label="Clear tool search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter tools by category">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              aria-pressed={activeCategory === 'all'}
              className={cn(
                'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                activeCategory === 'all'
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-surface-200 bg-white text-surface-700 hover:border-primary-300 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300',
              )}
            >
              All {TOOL_CATALOG.length}
            </button>
            {TOOL_CATEGORIES.map((category) => {
              const count = TOOL_CATALOG.filter((tool) => tool.category === category.id).length;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  aria-pressed={activeCategory === category.id}
                  className={cn(
                    'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    activeCategory === category.id
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-surface-200 bg-white text-surface-700 hover:border-primary-300 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300',
                  )}
                >
                  {category.name} {count}
                </button>
              );
            })}
          </div>

          {visibleCategories.length > 0 ? (
            <div className="mt-8 space-y-10" aria-live="polite">
              {visibleCategories.map((category) => (
                <section key={category.id} aria-labelledby={`category-${category.id}`}>
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <h3 id={`category-${category.id}`} className="text-lg font-semibold text-surface-950 dark:text-white">
                        {category.name}
                      </h3>
                      <p className="mt-0.5 text-sm text-surface-500 dark:text-surface-400">
                        {category.description}
                      </p>
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-surface-400">
                      {category.tools.length} {category.tools.length === 1 ? 'tool' : 'tools'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {category.tools.map((tool) => <ToolCard key={tool.path} tool={tool} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-surface-300 bg-white px-6 py-12 text-center dark:border-surface-700 dark:bg-surface-900">
              <Search className="mx-auto h-8 w-8 text-surface-400" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-surface-950 dark:text-white">No matching tools</h3>
              <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
                Try a format such as DOCX, a task such as compare, or clear the filters.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setToolQuery('');
                  setActiveCategory('all');
                }}
              >
                Show every tool
              </Button>
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 border-t border-surface-200 pt-10 dark:border-surface-800 lg:grid-cols-2" aria-label="Document shortcuts">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-surface-400" aria-hidden="true" />
                    Recent files
                  </CardTitle>
                  <CardDescription>Continue working on a saved document</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/files">View library</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentFiles.length > 0 ? (
                <div className="space-y-1">
                  {recentFiles.map((file) => (
                    <RecentFileItem
                      key={file.id}
                      file={file}
                      onToggleFavorite={(id) => void handleToggleFavorite(id)}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FolderOpen className="mx-auto h-10 w-10 text-surface-300 dark:text-surface-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-surface-700 dark:text-surface-300">No saved documents yet</p>
                  <p className="mt-1 text-xs text-surface-500">Import a PDF in the library or save from the editor.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Star className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                    Favorites
                  </CardTitle>
                  <CardDescription>Your pinned documents</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/history">View history</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {favoriteFiles.length > 0 ? (
                <div className="space-y-1">
                  {favoriteFiles.map((file) => (
                    <RecentFileItem
                      key={file.id}
                      file={file}
                      onToggleFavorite={(id) => void handleToggleFavorite(id)}
                      onDelete={(id) => void handleDelete(id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Star className="mx-auto h-10 w-10 text-surface-300 dark:text-surface-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-surface-700 dark:text-surface-300">No favorites yet</p>
                  <p className="mt-1 text-xs text-surface-500">Star a library document to keep it close.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-surface-200 px-4 py-6 dark:border-surface-800 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 text-sm text-surface-500 sm:flex-row sm:items-center sm:justify-between">
          <p>PDFLover · Privacy-first PDF workspace</p>
          <div className="flex gap-4">
            <Link className="hover:text-primary-600" to="/settings">Settings</Link>
            <Link className="hover:text-primary-600" to="/history">History</Link>
            <Link className="hover:text-primary-600" to="/files">Library</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
