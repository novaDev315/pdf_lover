import * as React from 'react';
import { BadgeCheck, Download, FileKey2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getOperationCapability, runServerPdfOperation } from '@/lib/api';
import { useApiCapabilities } from '@/hooks/useApiCapabilities';

function download(data: ArrayBuffer, filename: string, mediaType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mediaType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Certificate-backed signing kept separate from the local visual stamp tool. */
export function DigitalSignaturePanel() {
  const [pdf, setPdf] = React.useState<File | null>(null);
  const [certificate, setCertificate] = React.useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = React.useState('');
  const [signerName, setSignerName] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);
  const [progress, setProgress] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const capabilities = useApiCapabilities();
  const signingCapability = getOperationCapability(capabilities.data, 'pdf.digital-sign');
  const signingAvailable = signingCapability?.available === true;

  const sign = React.useCallback(async () => {
    if (!pdf || !certificate || !consent || !signingAvailable) return;
    setIsSigning(true);
    setCompleted(false);
    setError(null);
    try {
      const [artifact] = await runServerPdfOperation({
        operation: 'pdf.digital-sign',
        file: pdf,
        certificate,
        options: {
          certificatePassword,
          signerName: signerName.trim() || undefined,
          reason: reason.trim() || undefined,
          location: location.trim() || undefined,
          fieldName: `PDFLoverSignature_${Date.now()}`,
        },
        onProgress: (info) => setProgress(info.stage),
      });
      if (!artifact) throw new Error('Signing produced no PDF artifact');
      download(artifact.data, artifact.filename, artifact.mediaType);
      setCompleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Digital signing failed');
    } finally {
      setIsSigning(false);
      setProgress('');
    }
  }, [certificate, certificatePassword, consent, location, pdf, reason, signerName, signingAvailable]);

  return (
    <form
      className="space-y-5 rounded-lg border border-surface-200 bg-card p-6 dark:border-surface-800 dark:bg-surface-900"
      onSubmit={(event) => {
        event.preventDefault();
        void sign();
      }}
    >
      <div className="flex items-start gap-3">
        <FileKey2 className="mt-0.5 h-6 w-6 text-primary-500" />
        <div>
          <h2 className="font-semibold">Certificate-backed digital signature</h2>
          <p className="text-sm text-muted-foreground">
            Sign with a PKCS#12 certificate (.p12 or .pfx). The backend verifies cryptographic integrity, but certificate trust still depends on the recipient's trust store.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          PDF document
          <Input type="file" accept="application/pdf,.pdf" onChange={(event) => setPdf(event.target.files?.[0] ?? null)} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          PKCS#12 certificate
          <Input type="file" accept=".p12,.pfx,application/x-pkcs12" onChange={(event) => setCertificate(event.target.files?.[0] ?? null)} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Certificate password
          <Input type="password" value={certificatePassword} onChange={(event) => setCertificatePassword(event.target.value)} autoComplete="off" />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Signer name (optional)
          <Input value={signerName} maxLength={200} onChange={(event) => setSignerName(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Reason (optional)
          <Input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Location (optional)
          <Input value={location} maxLength={200} onChange={(event) => setLocation(event.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={!signingAvailable || isSigning} className="mt-0.5 rounded" />
        <span>Upload this PDF, certificate, and certificate password to the temporary backend for signing. Inputs are deleted after processing and the output after download or TTL.</span>
      </label>

      {!capabilities.isLoading && !signingAvailable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="status">
          {signingCapability?.unavailableReason ?? 'Certificate signing is unavailable on the configured backend.'}
        </p>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {completed && (
        <p className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          <BadgeCheck className="h-4 w-4" /> Signed PDF passed cryptographic integrity validation and was downloaded.
        </p>
      )}

      <Button type="submit" disabled={!pdf || !certificate || !consent || !signingAvailable || isSigning}>
        {isSigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {isSigning ? progress || 'Signing…' : 'Sign and download'}
      </Button>
    </form>
  );
}
