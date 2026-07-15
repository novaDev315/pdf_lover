#!/usr/bin/env python3
"""Apply and cryptographically verify a PKCS#12-backed PDF signature."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign import signers
from pyhanko.sign.validation import validate_pdf_signature
from pyhanko_certvalidator import ValidationContext


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--certificate", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--options", required=True, type=Path)
    args = parser.parse_args()

    options = json.loads(args.options.read_text(encoding="utf-8"))
    passphrase = options["certificatePassword"].encode("utf-8") or None
    signer = signers.SimpleSigner.load_pkcs12(
        str(args.certificate),
        passphrase=passphrase,
    )
    if signer is None:
        raise ValueError("PKCS#12 certificate or password was rejected")

    metadata = signers.PdfSignatureMetadata(
        field_name=options["fieldName"],
        name=options.get("signerName") or None,
        reason=options.get("reason") or None,
        location=options.get("location") or None,
    )
    with args.input.open("rb") as source, args.output.open("wb") as destination:
        writer = IncrementalPdfFileWriter(source)
        signers.sign_pdf(writer, signature_meta=metadata, signer=signer, output=destination)

    with args.output.open("rb") as signed_source:
        reader = PdfFileReader(signed_source)
        if not reader.embedded_signatures:
            raise ValueError("Signed output contains no embedded signature")
        status = validate_pdf_signature(
            reader.embedded_signatures[-1],
            signer_validation_context=ValidationContext(allow_fetching=False),
        )
        if not status.intact or not status.valid:
            raise ValueError("Signed output failed cryptographic integrity validation")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # Engine boundary: return one sanitized failure line.
        raise SystemExit(str(error) or error.__class__.__name__)
