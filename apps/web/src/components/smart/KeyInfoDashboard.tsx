/**
 * KeyInfoDashboard - PDF key information extraction dashboard
 * Extracts and displays structured information from PDF documents
 */

import * as React from 'react'
import {
  Calendar,
  DollarSign,
  User,
  Mail,
  Phone,
  MapPin,
  Link2,
  Hash,
  Download,
  X,
  FileText,
  Copy,
  Check,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Eye,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, TextItem } from 'pdfjs-dist/types/src/display/api'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileDropzone } from '@/components/file-manager/FileDropzone'
import { useToast } from '@/hooks/use-toast'
import { cn, formatFileSize, downloadBlob } from '@/lib/utils'
import {
  extractKeyInformation,
  exportToJSON,
  exportToCSV,
  type ExtractedInfo,
  type ExtractedDate,
  type ExtractedAmount,
  type ExtractedName,
  type ExtractedEmail,
  type ExtractedPhone,
  type ExtractedAddress,
  type ExtractedURL,
  type ExtractedID,
  type PageText,
  type TextLocation,
} from '@pdflover/pdf-core'

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

/**
 * Export format options
 */
type ExportFormat = 'json' | 'csv'

/**
 * Info type filter options
 */
type InfoType = 'dates' | 'amounts' | 'names' | 'emails' | 'phones' | 'addresses' | 'urls' | 'ids'

/**
 * Props for KeyInfoDashboard component
 */
export interface KeyInfoDashboardProps {
  /** Additional CSS classes */
  className?: string
  /** Callback when an item is clicked (for highlighting in PDF) */
  onItemClick?: (location: TextLocation) => void
  /** External PDF document (if loaded elsewhere) */
  externalPdfDoc?: PDFDocumentProxy
  /** External file (if loaded elsewhere) */
  externalFile?: File
}

/**
 * Processing state
 */
type ProcessingState = 'idle' | 'loading' | 'extracting' | 'complete' | 'error'

/**
 * Key Information Dashboard component
 *
 * Features:
 * - Upload PDF
 * - Dashboard layout with cards for each info type
 * - Click to highlight in document
 * - Copy individual items
 * - Export all extracted info (JSON, CSV)
 * - Search within extracted info
 * - Filter by type
 * - Summary statistics
 */
export function KeyInfoDashboard({
  className,
  onItemClick,
  externalPdfDoc,
  externalFile,
}: KeyInfoDashboardProps) {
  const [file, setFile] = React.useState<File | null>(externalFile || null)
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(externalPdfDoc || null)
  const [pageCount, setPageCount] = React.useState<number>(0)
  const [state, setState] = React.useState<ProcessingState>('idle')
  const [progress, setProgress] = React.useState({ percentage: 0, stage: '' })
  const [extractedInfo, setExtractedInfo] = React.useState<ExtractedInfo | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [activeFilters, setActiveFilters] = React.useState<Set<InfoType>>(new Set())
  const [expandedCards, setExpandedCards] = React.useState<Set<InfoType>>(
    new Set(['dates', 'amounts', 'emails'])
  )
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const { toast } = useToast()

  // Sync external props
  React.useEffect(() => {
    if (externalPdfDoc) {
      setPdfDoc(externalPdfDoc)
      setPageCount(externalPdfDoc.numPages)
    }
  }, [externalPdfDoc])

  React.useEffect(() => {
    if (externalFile) {
      setFile(externalFile)
    }
  }, [externalFile])

  /**
   * Handle file upload
   */
  const handleFileAccepted = React.useCallback(async (files: File[]) => {
    const pdfFile = files[0]
    if (!pdfFile) return

    setFile(pdfFile)
    setExtractedInfo(null)
    setState('loading')
    setProgress({ percentage: 0, stage: 'Loading PDF...' })

    try {
      const buffer = await pdfFile.arrayBuffer()
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise
      setPdfDoc(doc)
      setPageCount(doc.numPages)
      setState('idle')
    } catch {
      toast({
        title: 'Error reading PDF',
        description: 'Could not read the PDF file. Please try another file.',
        variant: 'destructive',
      })
      setFile(null)
      setPdfDoc(null)
      setState('error')
    }
  }, [toast])

  /**
   * Clear the selected file
   */
  const handleClearFile = React.useCallback(() => {
    setFile(null)
    setPdfDoc(null)
    setPageCount(0)
    setExtractedInfo(null)
    setState('idle')
    setSearchQuery('')
    setActiveFilters(new Set())
  }, [])

  /**
   * Extract text from all pages
   */
  const extractTextFromPdf = React.useCallback(async (doc: PDFDocumentProxy): Promise<PageText[]> => {
    const pages: PageText[] = []

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const textContent = await page.getTextContent()
      const text = textContent.items
        .map((item) => ('str' in item ? (item as TextItem).str : ''))
        .join(' ')
      pages.push({ page: i, text })
    }

    return pages
  }, [])

  /**
   * Extract key information from PDF
   */
  const handleExtract = React.useCallback(async () => {
    if (!pdfDoc) return

    setState('extracting')
    setProgress({ percentage: 0, stage: 'Extracting text...' })

    try {
      // Extract text from all pages
      const pages = await extractTextFromPdf(pdfDoc)
      setProgress({ percentage: 20, stage: 'Analyzing content...' })

      // Extract key information
      const result = await extractKeyInformation(pages, {
        onProgress: (info) => {
          setProgress({
            percentage: 20 + (info.percentage * 0.8),
            stage: info.stage,
          })
        },
        minConfidence: 50,
      })

      if (result.success && result.data) {
        setExtractedInfo(result.data)
        setState('complete')
        toast({
          title: 'Extraction complete',
          description: `Found ${result.data.summary.totalItems} items across ${result.data.summary.pagesWithContent.length} pages`,
        })
      } else {
        throw new Error(result.error || 'Extraction failed')
      }
    } catch (error) {
      toast({
        title: 'Extraction failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
      setState('error')
    }
  }, [pdfDoc, extractTextFromPdf, toast])

  /**
   * Copy item to clipboard
   */
  const copyToClipboard = React.useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast({
        title: 'Copied',
        description: 'Item copied to clipboard',
      })
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      })
    }
  }, [toast])

  /**
   * Export extracted information
   */
  const handleExport = React.useCallback((format: ExportFormat) => {
    if (!extractedInfo) return

    const baseFilename = file?.name.replace('.pdf', '') || 'extracted-info'

    if (format === 'json') {
      const json = exportToJSON(extractedInfo)
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(blob, `${baseFilename}_info.json`)
    } else {
      const csv = exportToCSV(extractedInfo, 'all')
      const blob = new Blob([csv], { type: 'text/csv' })
      downloadBlob(blob, `${baseFilename}_info.csv`)
    }

    toast({
      title: 'Export complete',
      description: `Downloaded ${format.toUpperCase()} file`,
    })
  }, [extractedInfo, file, toast])

  /**
   * Toggle card expansion
   */
  const toggleCardExpansion = React.useCallback((type: InfoType) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  /**
   * Toggle filter
   */
  const toggleFilter = React.useCallback((type: InfoType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  /**
   * Filter items by search query
   */
  const filterBySearch = React.useCallback(<T extends { id: string }>(
    items: T[],
    getSearchText: (item: T) => string
  ): T[] => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter((item) => getSearchText(item).toLowerCase().includes(query))
  }, [searchQuery])

  /**
   * Check if a type should be shown based on filters
   */
  const shouldShowType = React.useCallback((type: InfoType): boolean => {
    return activeFilters.size === 0 || activeFilters.has(type)
  }, [activeFilters])

  const isProcessing = state === 'loading' || state === 'extracting'
  const hasInfo = extractedInfo && extractedInfo.summary.totalItems > 0

  // Filter data based on search and filters
  const filteredDates = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.dates, (d) => d.original)
  }, [extractedInfo, filterBySearch])

  const filteredAmounts = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.amounts, (a) => `${a.original} ${a.currency}`)
  }, [extractedInfo, filterBySearch])

  const filteredNames = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.names, (n) => n.fullName)
  }, [extractedInfo, filterBySearch])

  const filteredEmails = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.emails, (e) => e.email)
  }, [extractedInfo, filterBySearch])

  const filteredPhones = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.phones, (p) => `${p.original} ${p.normalized}`)
  }, [extractedInfo, filterBySearch])

  const filteredAddresses = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.addresses, (a) => a.fullAddress)
  }, [extractedInfo, filterBySearch])

  const filteredUrls = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.urls, (u) => u.url)
  }, [extractedInfo, filterBySearch])

  const filteredIds = React.useMemo(() => {
    if (!extractedInfo) return []
    return filterBySearch(extractedInfo.ids, (i) => `${i.original} ${i.type}`)
  }, [extractedInfo, filterBySearch])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-500" />
          Key Information Extraction
        </CardTitle>
        <CardDescription>
          Extract dates, amounts, names, emails, phones, addresses, URLs, and IDs from PDF documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload */}
        {!file ? (
          <FileDropzone
            onFilesAccepted={handleFileAccepted}
            multiple={false}
            maxFiles={1}
          />
        ) : (
          <div className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
            <div className="flex-shrink-0 w-12 h-16 bg-white dark:bg-surface-700 rounded flex items-center justify-center">
              <FileText className="h-6 w-6 text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {file.name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {formatFileSize(file.size)} - {pageCount} pages
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearFile}
              disabled={isProcessing}
              className="text-surface-400 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Progress Indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-600 dark:text-surface-400">
                {progress.stage || 'Processing...'}
              </span>
              <span className="font-medium">{Math.round(progress.percentage)}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        {/* Extract Button */}
        {file && pdfDoc && !hasInfo && !isProcessing && (
          <Button
            onClick={handleExtract}
            disabled={isProcessing}
            className="w-full"
          >
            <Search className="h-4 w-4 mr-2" />
            Extract Key Information
          </Button>
        )}

        {/* Results Dashboard */}
        {hasInfo && extractedInfo && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                icon={<Hash className="h-4 w-4" />}
                label="Total Items"
                value={extractedInfo.summary.totalItems}
                color="blue"
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                label="Pages"
                value={extractedInfo.summary.pagesWithContent.length}
                color="green"
              />
              {Object.keys(extractedInfo.summary.totalsByCurrency).length > 0 && (
                <StatCard
                  icon={<DollarSign className="h-4 w-4" />}
                  label="Totals by Currency"
                  value={Object.entries(extractedInfo.summary.totalsByCurrency)
                    .map(([currency, value]) => `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
                    .join(' · ')}
                  color="amber"
                />
              )}
              <StatCard
                icon={<Link2 className="h-4 w-4" />}
                label="Domains"
                value={extractedInfo.summary.uniqueDomains.length}
                color="purple"
              />
            </div>

            {/* Search and Filter Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
                <Input
                  placeholder="Search extracted information..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('dates')}
                    onCheckedChange={() => toggleFilter('dates')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Dates
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('amounts')}
                    onCheckedChange={() => toggleFilter('amounts')}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Amounts
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('names')}
                    onCheckedChange={() => toggleFilter('names')}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Names
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('emails')}
                    onCheckedChange={() => toggleFilter('emails')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Emails
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('phones')}
                    onCheckedChange={() => toggleFilter('phones')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Phones
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('addresses')}
                    onCheckedChange={() => toggleFilter('addresses')}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Addresses
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('urls')}
                    onCheckedChange={() => toggleFilter('urls')}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    URLs
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={activeFilters.has('ids')}
                    onCheckedChange={() => toggleFilter('ids')}
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    IDs
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveFilters(new Set())}>
                    Clear Filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('json')}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Info Cards */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="dates" disabled={extractedInfo.dates.length === 0}>
                  Dates ({extractedInfo.dates.length})
                </TabsTrigger>
                <TabsTrigger value="amounts" disabled={extractedInfo.amounts.length === 0}>
                  Amounts ({extractedInfo.amounts.length})
                </TabsTrigger>
                <TabsTrigger value="contacts" disabled={extractedInfo.emails.length + extractedInfo.phones.length === 0}>
                  Contacts ({extractedInfo.emails.length + extractedInfo.phones.length})
                </TabsTrigger>
                <TabsTrigger value="references" disabled={extractedInfo.urls.length + extractedInfo.ids.length === 0}>
                  References ({extractedInfo.urls.length + extractedInfo.ids.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4 space-y-4">
                {/* Dates Card */}
                {shouldShowType('dates') && filteredDates.length > 0 && (
                  <InfoCard
                    title="Dates"
                    icon={<Calendar className="h-5 w-5 text-blue-500" />}
                    count={filteredDates.length}
                    isExpanded={expandedCards.has('dates')}
                    onToggle={() => toggleCardExpansion('dates')}
                  >
                    <div className="space-y-2">
                      {filteredDates.slice(0, expandedCards.has('dates') ? undefined : 5).map((date) => (
                        <DateItem
                          key={date.id}
                          date={date}
                          onCopy={() => copyToClipboard(date.original, date.id)}
                          onClick={() => onItemClick?.(date.location)}
                          isCopied={copiedId === date.id}
                        />
                      ))}
                      {!expandedCards.has('dates') && filteredDates.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredDates.length - 5} more dates
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Amounts Card */}
                {shouldShowType('amounts') && filteredAmounts.length > 0 && (
                  <InfoCard
                    title="Amounts"
                    icon={<DollarSign className="h-5 w-5 text-green-500" />}
                    count={filteredAmounts.length}
                    isExpanded={expandedCards.has('amounts')}
                    onToggle={() => toggleCardExpansion('amounts')}
                  >
                    <div className="space-y-2">
                      {filteredAmounts.slice(0, expandedCards.has('amounts') ? undefined : 5).map((amount) => (
                        <AmountItem
                          key={amount.id}
                          amount={amount}
                          onCopy={() => copyToClipboard(amount.original, amount.id)}
                          onClick={() => onItemClick?.(amount.location)}
                          isCopied={copiedId === amount.id}
                        />
                      ))}
                      {!expandedCards.has('amounts') && filteredAmounts.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredAmounts.length - 5} more amounts
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Names Card */}
                {shouldShowType('names') && filteredNames.length > 0 && (
                  <InfoCard
                    title="Names"
                    icon={<User className="h-5 w-5 text-purple-500" />}
                    count={filteredNames.length}
                    isExpanded={expandedCards.has('names')}
                    onToggle={() => toggleCardExpansion('names')}
                  >
                    <div className="space-y-2">
                      {filteredNames.slice(0, expandedCards.has('names') ? undefined : 5).map((name) => (
                        <NameItem
                          key={name.id}
                          name={name}
                          onCopy={() => copyToClipboard(name.fullName, name.id)}
                          onClick={() => onItemClick?.(name.location)}
                          isCopied={copiedId === name.id}
                        />
                      ))}
                      {!expandedCards.has('names') && filteredNames.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredNames.length - 5} more names
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Emails Card */}
                {shouldShowType('emails') && filteredEmails.length > 0 && (
                  <InfoCard
                    title="Email Addresses"
                    icon={<Mail className="h-5 w-5 text-red-500" />}
                    count={filteredEmails.length}
                    isExpanded={expandedCards.has('emails')}
                    onToggle={() => toggleCardExpansion('emails')}
                  >
                    <div className="space-y-2">
                      {filteredEmails.slice(0, expandedCards.has('emails') ? undefined : 5).map((email) => (
                        <EmailItem
                          key={email.id}
                          email={email}
                          onCopy={() => copyToClipboard(email.email, email.id)}
                          onClick={() => onItemClick?.(email.location)}
                          isCopied={copiedId === email.id}
                        />
                      ))}
                      {!expandedCards.has('emails') && filteredEmails.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredEmails.length - 5} more emails
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Phones Card */}
                {shouldShowType('phones') && filteredPhones.length > 0 && (
                  <InfoCard
                    title="Phone Numbers"
                    icon={<Phone className="h-5 w-5 text-teal-500" />}
                    count={filteredPhones.length}
                    isExpanded={expandedCards.has('phones')}
                    onToggle={() => toggleCardExpansion('phones')}
                  >
                    <div className="space-y-2">
                      {filteredPhones.slice(0, expandedCards.has('phones') ? undefined : 5).map((phone) => (
                        <PhoneItem
                          key={phone.id}
                          phone={phone}
                          onCopy={() => copyToClipboard(phone.original, phone.id)}
                          onClick={() => onItemClick?.(phone.location)}
                          isCopied={copiedId === phone.id}
                        />
                      ))}
                      {!expandedCards.has('phones') && filteredPhones.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredPhones.length - 5} more phones
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* Addresses Card */}
                {shouldShowType('addresses') && filteredAddresses.length > 0 && (
                  <InfoCard
                    title="Addresses"
                    icon={<MapPin className="h-5 w-5 text-orange-500" />}
                    count={filteredAddresses.length}
                    isExpanded={expandedCards.has('addresses')}
                    onToggle={() => toggleCardExpansion('addresses')}
                  >
                    <div className="space-y-2">
                      {filteredAddresses.slice(0, expandedCards.has('addresses') ? undefined : 5).map((address) => (
                        <AddressItem
                          key={address.id}
                          address={address}
                          onCopy={() => copyToClipboard(address.fullAddress, address.id)}
                          onClick={() => onItemClick?.(address.location)}
                          isCopied={copiedId === address.id}
                        />
                      ))}
                      {!expandedCards.has('addresses') && filteredAddresses.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredAddresses.length - 5} more addresses
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* URLs Card */}
                {shouldShowType('urls') && filteredUrls.length > 0 && (
                  <InfoCard
                    title="URLs"
                    icon={<Link2 className="h-5 w-5 text-cyan-500" />}
                    count={filteredUrls.length}
                    isExpanded={expandedCards.has('urls')}
                    onToggle={() => toggleCardExpansion('urls')}
                  >
                    <div className="space-y-2">
                      {filteredUrls.slice(0, expandedCards.has('urls') ? undefined : 5).map((url) => (
                        <UrlItem
                          key={url.id}
                          url={url}
                          onCopy={() => copyToClipboard(url.url, url.id)}
                          onClick={() => onItemClick?.(url.location)}
                          isCopied={copiedId === url.id}
                        />
                      ))}
                      {!expandedCards.has('urls') && filteredUrls.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredUrls.length - 5} more URLs
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}

                {/* IDs Card */}
                {shouldShowType('ids') && filteredIds.length > 0 && (
                  <InfoCard
                    title="IDs & References"
                    icon={<Hash className="h-5 w-5 text-indigo-500" />}
                    count={filteredIds.length}
                    isExpanded={expandedCards.has('ids')}
                    onToggle={() => toggleCardExpansion('ids')}
                  >
                    <div className="space-y-2">
                      {filteredIds.slice(0, expandedCards.has('ids') ? undefined : 5).map((id) => (
                        <IdItem
                          key={id.id}
                          idInfo={id}
                          onCopy={() => copyToClipboard(id.original, id.id)}
                          onClick={() => onItemClick?.(id.location)}
                          isCopied={copiedId === id.id}
                        />
                      ))}
                      {!expandedCards.has('ids') && filteredIds.length > 5 && (
                        <p className="text-xs text-surface-500 text-center pt-2">
                          +{filteredIds.length - 5} more IDs
                        </p>
                      )}
                    </div>
                  </InfoCard>
                )}
              </TabsContent>

              <TabsContent value="dates" className="mt-4">
                <InfoCard
                  title="Dates"
                  icon={<Calendar className="h-5 w-5 text-blue-500" />}
                  count={filteredDates.length}
                  isExpanded={true}
                  onToggle={() => {}}
                >
                  <div className="space-y-2">
                    {filteredDates.map((date) => (
                      <DateItem
                        key={date.id}
                        date={date}
                        onCopy={() => copyToClipboard(date.original, date.id)}
                        onClick={() => onItemClick?.(date.location)}
                        isCopied={copiedId === date.id}
                      />
                    ))}
                  </div>
                </InfoCard>
              </TabsContent>

              <TabsContent value="amounts" className="mt-4">
                <InfoCard
                  title="Amounts"
                  icon={<DollarSign className="h-5 w-5 text-green-500" />}
                  count={filteredAmounts.length}
                  isExpanded={true}
                  onToggle={() => {}}
                >
                  <div className="space-y-2">
                    {filteredAmounts.map((amount) => (
                      <AmountItem
                        key={amount.id}
                        amount={amount}
                        onCopy={() => copyToClipboard(amount.original, amount.id)}
                        onClick={() => onItemClick?.(amount.location)}
                        isCopied={copiedId === amount.id}
                      />
                    ))}
                  </div>
                </InfoCard>
              </TabsContent>

              <TabsContent value="contacts" className="mt-4 space-y-4">
                {filteredEmails.length > 0 && (
                  <InfoCard
                    title="Email Addresses"
                    icon={<Mail className="h-5 w-5 text-red-500" />}
                    count={filteredEmails.length}
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="space-y-2">
                      {filteredEmails.map((email) => (
                        <EmailItem
                          key={email.id}
                          email={email}
                          onCopy={() => copyToClipboard(email.email, email.id)}
                          onClick={() => onItemClick?.(email.location)}
                          isCopied={copiedId === email.id}
                        />
                      ))}
                    </div>
                  </InfoCard>
                )}
                {filteredPhones.length > 0 && (
                  <InfoCard
                    title="Phone Numbers"
                    icon={<Phone className="h-5 w-5 text-teal-500" />}
                    count={filteredPhones.length}
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="space-y-2">
                      {filteredPhones.map((phone) => (
                        <PhoneItem
                          key={phone.id}
                          phone={phone}
                          onCopy={() => copyToClipboard(phone.original, phone.id)}
                          onClick={() => onItemClick?.(phone.location)}
                          isCopied={copiedId === phone.id}
                        />
                      ))}
                    </div>
                  </InfoCard>
                )}
              </TabsContent>

              <TabsContent value="references" className="mt-4 space-y-4">
                {filteredUrls.length > 0 && (
                  <InfoCard
                    title="URLs"
                    icon={<Link2 className="h-5 w-5 text-cyan-500" />}
                    count={filteredUrls.length}
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="space-y-2">
                      {filteredUrls.map((url) => (
                        <UrlItem
                          key={url.id}
                          url={url}
                          onCopy={() => copyToClipboard(url.url, url.id)}
                          onClick={() => onItemClick?.(url.location)}
                          isCopied={copiedId === url.id}
                        />
                      ))}
                    </div>
                  </InfoCard>
                )}
                {filteredIds.length > 0 && (
                  <InfoCard
                    title="IDs & References"
                    icon={<Hash className="h-5 w-5 text-indigo-500" />}
                    count={filteredIds.length}
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="space-y-2">
                      {filteredIds.map((id) => (
                        <IdItem
                          key={id.id}
                          idInfo={id}
                          onCopy={() => copyToClipboard(id.original, id.id)}
                          onClick={() => onItemClick?.(id.location)}
                          isCopied={copiedId === id.id}
                        />
                      ))}
                    </div>
                  </InfoCard>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* No results message */}
        {state === 'complete' && extractedInfo && extractedInfo.summary.totalItems === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-surface-300 dark:text-surface-600 mb-4" />
            <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-2">
              No Information Found
            </h3>
            <p className="text-surface-500 dark:text-surface-400">
              No dates, amounts, emails, or other key information was detected in this document.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: 'blue' | 'green' | 'amber' | 'purple'
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
  }

  return (
    <div className={cn('p-4 rounded-lg', colors[color])}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

interface InfoCardProps {
  title: string
  icon: React.ReactNode
  count: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function InfoCard({ title, icon, count, isExpanded, onToggle, children }: InfoCardProps) {
  return (
    <div className="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-medium text-surface-900 dark:text-white">{title}</span>
          <span className="text-sm text-surface-500 dark:text-surface-400">({count})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-surface-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 border-t border-surface-200 dark:border-surface-700">
          {children}
        </div>
      )}
    </div>
  )
}

interface ItemProps {
  onCopy: () => void
  onClick: () => void
  isCopied: boolean
}

function DateItem({ date, onCopy, onClick, isCopied }: ItemProps & { date: ExtractedDate }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {date.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{date.original}</p>
          <p className="text-xs text-surface-500">
            {date.parsed?.toLocaleDateString()} - {date.format} format
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {date.location.page}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function AmountItem({ amount, onCopy, onClick, isCopied }: ItemProps & { amount: ExtractedAmount }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {amount.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{amount.original}</p>
          <p className="text-xs text-surface-500">
            {amount.value.toLocaleString()} {amount.currency}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {amount.location.page}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function NameItem({ name, onCopy, onClick, isCopied }: ItemProps & { name: ExtractedName }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {name.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{name.fullName}</p>
          {(name.firstName || name.lastName) && (
            <p className="text-xs text-surface-500">
              {name.title && `${name.title}. `}
              {name.firstName} {name.lastName}
              {name.suffix && `, ${name.suffix}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {name.location.page}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function EmailItem({ email, onCopy, onClick, isCopied }: ItemProps & { email: ExtractedEmail }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {email.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{email.email}</p>
          <p className="text-xs text-surface-500">@{email.domain}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {email.location.page}</span>
        <a
          href={`mailto:${email.email}`}
          className="text-surface-400 hover:text-primary-500"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function PhoneItem({ phone, onCopy, onClick, isCopied }: ItemProps & { phone: ExtractedPhone }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {phone.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{phone.original}</p>
          <p className="text-xs text-surface-500">
            {phone.format} format
            {phone.countryCode && ` (+${phone.countryCode})`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {phone.location.page}</span>
        <a
          href={`tel:${phone.normalized}`}
          className="text-surface-400 hover:text-primary-500"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function AddressItem({ address, onCopy, onClick, isCopied }: ItemProps & { address: ExtractedAddress }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {address.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{address.fullAddress}</p>
          {(address.city || address.state) && (
            <p className="text-xs text-surface-500">
              {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {address.location.page}</span>
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(address.fullAddress)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-surface-400 hover:text-primary-500"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function UrlItem({ url, onCopy, onClick, isCopied }: ItemProps & { url: ExtractedURL }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {url.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{url.url}</p>
          <p className="text-xs text-surface-500">
            {url.domain}
            {url.isSecure && ' - Secure'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {url.location.page}</span>
        <a
          href={url.url.startsWith('http') ? url.url : `https://${url.url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-surface-400 hover:text-primary-500"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function IdItem({ idInfo, onCopy, onClick, isCopied }: ItemProps & { idInfo: ExtractedID }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 group">
      <div className="flex items-center gap-3 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClick}
                className="text-surface-400 hover:text-primary-500"
              >
                <Eye className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>View in document (Page {idInfo.location.page})</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <p className="font-medium text-surface-900 dark:text-white truncate">{idInfo.original}</p>
          <p className="text-xs text-surface-500">
            {idInfo.type}
            {idInfo.isValid ? ' - Valid' : ' - Unverified'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-400">Page {idInfo.location.page}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopy}>
          {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}
